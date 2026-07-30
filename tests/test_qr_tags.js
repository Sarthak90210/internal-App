const assert = require('assert');
const { resetMocks, firestoreStore } = require('./setup');

const {
  generateShortCode,
  generateUniqueCodes,
  isValidCode,
  normalizeCode,
  CODE_ALPHABET,
  CODE_DATA_LENGTH,
} = require('../src/lib/shortCode');
const { resolveEffectiveHolder, isInheritedHolder } = require('../src/lib/custody');
const { buildInventoryPath } = require('../src/lib/inventoryHelpers');
const { decideScanAction } = require('../src/lib/scanResolver');
const { buildQrSvg } = require('../src/lib/qrSvg');
const { buildSheetHtml, exportTagsSheet } = require('../src/services/tagExport');
const { TagsService } = require('../src/services/assetTags');
const { InventoryService } = require('../src/services/inventory');
const { useAuthStore } = require('../src/stores/authStore');

// Deterministic byte source so generated codes are reproducible in tests.
// State (`x`) persists across calls so successive codes differ.
const seededBytes = (seed) => {
  let x = seed;
  return (n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      out.push((x >>> 16) & 0xff);
    }
    return out;
  };
};

async function testQrTags() {
  console.log('\n--- Running QR Asset-Tag Tests ---');
  let passed = 0;
  let failed = 0;
  const errors = [];

  const runTest = async (name, fn) => {
    try {
      resetMocks();
      await fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ FAILED: ${name}`);
      console.log(`    Error message: ${err.message}`);
      failed++;
      errors.push({ test: name, error: err });
    }
  };

  // ─── shortCode ────────────────────────────────────────────────────

  await runTest('generateShortCode produces a valid, correctly-sized code', async () => {
    const code = generateShortCode(seededBytes(7));
    assert.strictEqual(code.length, CODE_DATA_LENGTH + 1);
    assert.ok([...code].every((c) => CODE_ALPHABET.includes(c)), 'all chars in alphabet');
    assert.ok(isValidCode(code), 'passes its own check digit');
  });

  await runTest('isValidCode rejects a single-character typo', async () => {
    const code = generateShortCode(seededBytes(42));
    const chars = [...code];
    // Corrupt the first data char to a different alphabet symbol.
    chars[0] = CODE_ALPHABET[(CODE_ALPHABET.indexOf(chars[0]) + 1) % CODE_ALPHABET.length];
    assert.strictEqual(isValidCode(chars.join('')), false);
  });

  await runTest('normalizeCode folds ambiguous letters and strips separators', async () => {
    // O→0, I/L→1, U→V, lower→upper, hyphens/space removed
    assert.strictEqual(normalizeCode('o i l u'), '011V');
    assert.strictEqual(normalizeCode('k7m2-qx90'), 'K7M2QX90');
  });

  await runTest('isValidCode accepts an ambiguous-letter variant of a real code', async () => {
    const code = generateShortCode(seededBytes(99)); // canonical (no ambiguous letters)
    // Re-introduce ambiguity a human might type; normalisation should recover it.
    const messy = code.toLowerCase().replace(/0/g, 'O').replace(/1/g, 'l');
    assert.ok(isValidCode(messy));
  });

  await runTest('generateUniqueCodes returns the requested count with no dupes', async () => {
    const codes = generateUniqueCodes(25, seededBytes(3));
    assert.strictEqual(codes.length, 25);
    assert.strictEqual(new Set(codes).size, 25);
  });

  // ─── custody resolver ─────────────────────────────────────────────

  await runTest('resolveEffectiveHolder: explicit item holder overrides folder', async () => {
    const allInvs = [{ id: 'f1', name: 'Motors', parentInventoryId: null, currentHolder: 'alice@t' }];
    const item = { id: 'i1', inventoryId: 'f1', currentHolder: 'bob@t' };
    const res = resolveEffectiveHolder(item, 'item', allInvs);
    assert.strictEqual(res.holder, 'bob@t');
    assert.strictEqual(res.source, 'self');
  });

  await runTest('resolveEffectiveHolder: item with no holder inherits folder owner', async () => {
    const allInvs = [{ id: 'f1', name: 'Motors', parentInventoryId: null, currentHolder: 'alice@t' }];
    const item = { id: 'i1', inventoryId: 'f1', currentHolder: null };
    const res = resolveEffectiveHolder(item, 'item', allInvs);
    assert.strictEqual(res.holder, 'alice@t');
    assert.strictEqual(res.source, 'inherited');
    assert.strictEqual(res.from.id, 'f1');
    assert.ok(isInheritedHolder(item, 'item', allInvs));
  });

  await runTest('resolveEffectiveHolder: inherits from nearest ancestor up a chain', async () => {
    const allInvs = [
      { id: 'root', name: 'Root', parentInventoryId: null, currentHolder: 'alice@t' },
      { id: 'mid', name: 'Mid', parentInventoryId: 'root', currentHolder: null },
      { id: 'leaf', name: 'Leaf', parentInventoryId: 'mid', currentHolder: null },
    ];
    const leaf = allInvs[2];
    const res = resolveEffectiveHolder(leaf, 'inventory', allInvs);
    assert.strictEqual(res.holder, 'alice@t');
    assert.strictEqual(res.from.id, 'root');
  });

  await runTest('resolveEffectiveHolder: nearest holder wins over farther ancestor', async () => {
    const allInvs = [
      { id: 'root', name: 'Root', parentInventoryId: null, currentHolder: 'alice@t' },
      { id: 'mid', name: 'Mid', parentInventoryId: 'root', currentHolder: 'carol@t' },
    ];
    const item = { id: 'i1', inventoryId: 'mid', currentHolder: null };
    const res = resolveEffectiveHolder(item, 'item', allInvs);
    assert.strictEqual(res.holder, 'carol@t');
    assert.strictEqual(res.from.id, 'mid');
  });

  await runTest('resolveEffectiveHolder: nobody holds → none', async () => {
    const allInvs = [{ id: 'f1', name: 'F', parentInventoryId: null, currentHolder: null }];
    const res = resolveEffectiveHolder({ id: 'i1', inventoryId: 'f1' }, 'item', allInvs);
    assert.strictEqual(res.holder, null);
    assert.strictEqual(res.source, 'none');
  });

  await runTest('resolveEffectiveHolder: parent cycle does not hang', async () => {
    const allInvs = [
      { id: 'a', name: 'A', parentInventoryId: 'b', currentHolder: null },
      { id: 'b', name: 'B', parentInventoryId: 'a', currentHolder: null },
    ];
    const res = resolveEffectiveHolder(allInvs[0], 'inventory', allInvs);
    assert.strictEqual(res.holder, null);
  });

  // ─── scan resolver (pure decision) ────────────────────────────────

  await runTest('decideScanAction: invalid / not_found / retired', async () => {
    assert.strictEqual(decideScanAction({ status: 'invalid' }, {}).kind, 'error');
    assert.strictEqual(decideScanAction({ status: 'not_found' }, {}).kind, 'error');
    const retired = decideScanAction(
      { status: 'retired', tag: { supersededBy: 'NEWCODE1' } },
      { surface: 'folder', containerId: 'f1' }
    );
    assert.strictEqual(retired.kind, 'retired');
    assert.strictEqual(retired.supersededBy, 'NEWCODE1');
  });

  await runTest('decideScanAction: unassigned binds into a folder container', async () => {
    const res = decideScanAction({ status: 'unassigned', tag: {} }, { surface: 'folder', containerId: 'f1' });
    assert.strictEqual(res.kind, 'bind');
    assert.deepStrictEqual(res.container, { type: 'inventory', id: 'f1' });
  });

  await runTest('decideScanAction: unassigned from home has no bind context', async () => {
    const res = decideScanAction({ status: 'unassigned', tag: {} }, { surface: 'home' });
    assert.strictEqual(res.kind, 'bind_no_context');
  });

  await runTest('decideScanAction: active tag resolves with navigate+hold', async () => {
    const res = decideScanAction(
      { status: 'active', tag: { entityType: 'item', entityId: 'i1' } },
      { surface: 'home' }
    );
    assert.strictEqual(res.kind, 'resolved');
    assert.deepStrictEqual(res.entity, { type: 'item', id: 'i1' });
    assert.deepStrictEqual(res.offers, ['navigate', 'hold']);
  });

  await runTest('decideScanAction: active tag on a different folder page offers move', async () => {
    const res = decideScanAction(
      { status: 'active', tag: { entityType: 'inventory', entityId: 'other' } },
      { surface: 'folder', containerId: 'f1' }
    );
    assert.ok(res.offers.includes('move'));
  });

  await runTest('decideScanAction: active tag on its OWN folder page does not offer move', async () => {
    const res = decideScanAction(
      { status: 'active', tag: { entityType: 'inventory', entityId: 'f1' } },
      { surface: 'folder', containerId: 'f1' }
    );
    assert.ok(!res.offers.includes('move'));
  });

  // ─── inventory path (global search) ───────────────────────────────

  await runTest('buildInventoryPath builds full List / Folder / Sub-folder path', async () => {
    const lists = [{ id: 'l1', name: 'Main List' }];
    const allInvs = [
      { id: 'f1', name: 'Motors', listId: 'l1', parentInventoryId: null },
      { id: 'f2', name: 'Screws', listId: 'l1', parentInventoryId: 'f1' },
    ];
    // Item lives in f2 → path is List / Motors / Screws
    assert.strictEqual(buildInventoryPath('f2', allInvs, lists), 'Main List / Motors / Screws');
    // Top-level folder → List / Motors
    assert.strictEqual(buildInventoryPath('f1', allInvs, lists), 'Main List / Motors');
  });

  await runTest('buildInventoryPath handles missing/parentless gracefully', async () => {
    const lists = [{ id: 'l1', name: 'Main List' }];
    const allInvs = [{ id: 'f1', name: 'Motors', listId: 'l1', parentInventoryId: null }];
    assert.strictEqual(buildInventoryPath(null, allInvs, lists), '');
    assert.strictEqual(buildInventoryPath('nope', allInvs, lists), '');
  });

  await runTest('buildInventoryPath is cycle-safe', async () => {
    const allInvs = [
      { id: 'a', name: 'A', listId: 'l1', parentInventoryId: 'b' },
      { id: 'b', name: 'B', listId: 'l1', parentInventoryId: 'a' },
    ];
    // Should terminate, not hang.
    const path = buildInventoryPath('a', allInvs, [{ id: 'l1', name: 'L' }]);
    assert.ok(typeof path === 'string');
  });

  // ─── TagsService (Firestore-backed) ───────────────────────────────

  await runTest('mintBatch creates N unassigned tag docs keyed by code', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    const codes = await TagsService.mintBatch(5, seededBytes(11));
    assert.strictEqual(codes.length, 5);
    for (const code of codes) {
      const stored = firestoreStore.get(`${'asset_tags'}/${code}`);
      assert.ok(stored, `tag ${code} persisted`);
      assert.strictEqual(stored.status, 'unassigned');
      assert.strictEqual(stored.entityId, null);
    }
  });

  await runTest('getByCode resolves status for unassigned / invalid / not_found', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    const [code] = await TagsService.mintBatch(1, seededBytes(5));
    assert.strictEqual((await TagsService.getByCode(code)).status, 'unassigned');
    assert.strictEqual((await TagsService.getByCode('NOTREAL!')).status, 'invalid');
    // Valid-shaped but never minted → not_found
    const ghost = generateShortCode(seededBytes(777));
    assert.strictEqual((await TagsService.getByCode(ghost)).status, 'not_found');
  });

  await runTest('bindTag binds an unassigned tag and caches activeTagId on entity', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    firestoreStore.set('inventories/inv1', { name: 'Motors', activeTagId: null });
    const [code] = await TagsService.mintBatch(1, seededBytes(21));

    const res = await TagsService.bindTag({ code, entityType: 'inventory', entityId: 'inv1' });
    assert.strictEqual(res.ok, true);

    const tag = firestoreStore.get(`asset_tags/${code}`);
    assert.strictEqual(tag.status, 'active');
    assert.strictEqual(tag.entityType, 'inventory');
    assert.strictEqual(tag.entityId, 'inv1');
    assert.strictEqual(firestoreStore.get('inventories/inv1').activeTagId, code);
  });

  await runTest('bindTag refuses to rebind an already-active tag (immutability)', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    firestoreStore.set('inventories/inv1', { name: 'Motors' });
    firestoreStore.set('items/itm1', { name: 'Flux', inventoryId: 'inv1' });
    const [code] = await TagsService.mintBatch(1, seededBytes(31));

    await TagsService.bindTag({ code, entityType: 'inventory', entityId: 'inv1' });
    const second = await TagsService.bindTag({ code, entityType: 'item', entityId: 'itm1' });
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.reason, 'already_bound');
    // Original binding untouched.
    assert.strictEqual(firestoreStore.get(`asset_tags/${code}`).entityId, 'inv1');
  });

  await runTest('retireAndReissue retires old tag, binds new, links supersededBy', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    firestoreStore.set('inventories/inv1', { name: 'Motors' });
    const [oldCode, newCode] = await TagsService.mintBatch(2, seededBytes(41));

    await TagsService.bindTag({ code: oldCode, entityType: 'inventory', entityId: 'inv1' });
    const res = await TagsService.retireAndReissue({ entityType: 'inventory', entityId: 'inv1', newCode });
    assert.strictEqual(res.ok, true);

    const oldTag = firestoreStore.get(`asset_tags/${oldCode}`);
    const newTag = firestoreStore.get(`asset_tags/${newCode}`);
    assert.strictEqual(oldTag.status, 'retired');
    assert.strictEqual(oldTag.supersededBy, newCode);
    assert.strictEqual(newTag.status, 'active');
    assert.strictEqual(firestoreStore.get('inventories/inv1').activeTagId, newCode);
  });

  await runTest('scanning a retired tag reports retired status', async () => {
    useAuthStore.getState().setUser({ email: 'admin@t' });
    firestoreStore.set('inventories/inv1', { name: 'Motors' });
    const [oldCode, newCode] = await TagsService.mintBatch(2, seededBytes(51));
    await TagsService.bindTag({ code: oldCode, entityType: 'inventory', entityId: 'inv1' });
    await TagsService.retireAndReissue({ entityType: 'inventory', entityId: 'inv1', newCode });

    const resolved = await TagsService.getByCode(oldCode);
    assert.strictEqual(resolved.status, 'retired');
    assert.strictEqual(resolved.tag.supersededBy, newCode);
  });

  // ─── QR SVG + export sheet (pure) ─────────────────────────────────

  await runTest('buildQrSvg returns a scalable inline SVG for a code', async () => {
    const svg = buildQrSvg('K7M2QX90');
    assert.ok(svg.startsWith('<svg'), 'is an svg string');
    assert.ok(svg.includes('viewBox'), 'is scalable');
    assert.ok(!svg.includes('react-native'), 'no native svg dependency');
  });

  await runTest('buildSheetHtml embeds one QR + code per tag', async () => {
    const codes = ['AAAA1111', 'BBBB2222', 'CCCC3333'];
    const html = buildSheetHtml(codes);
    assert.ok(html.includes('<!DOCTYPE html>'));
    for (const code of codes) {
      assert.ok(html.includes(code), `sheet contains ${code}`);
    }
    // One <svg> per code.
    assert.strictEqual((html.match(/<svg/g) || []).length, codes.length);
  });

  await runTest('exportTagsSheet uses the new File API and does not throw', async () => {
    // Regression: writeAsStringAsync was deprecated in SDK 54 and threw at runtime.
    await exportTagsSheet(['AAAA1111', 'BBBB2222'], 'test_tags.html');
  });

  await runTest('exportTagsSheet rejects an empty batch', async () => {
    let threw = false;
    try {
      await exportTagsSheet([]);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true);
  });

  // ─── item custody service ─────────────────────────────────────────

  await runTest('holdItem sets explicit holder and logs history', async () => {
    useAuthStore.getState().setUser({ email: 'bob@t' });
    firestoreStore.set('items/itm1', { name: 'Flux', inventoryId: 'inv1', quantity: 50 });

    await InventoryService.holdItem('itm1', 'bob@t');
    const item = firestoreStore.get('items/itm1');
    assert.strictEqual(item.currentHolder, 'bob@t');
    assert.strictEqual(item.quantity, 50, 'quantity untouched by hold');
    assert.ok(item.currentHolderSince);
  });

  await runTest('releaseItem clears explicit holder so it reverts to inheritance', async () => {
    useAuthStore.getState().setUser({ email: 'bob@t' });
    firestoreStore.set('items/itm1', {
      name: 'Flux', inventoryId: 'inv1', quantity: 50, currentHolder: 'bob@t', currentHolderSince: 'x',
    });

    await InventoryService.releaseItem('itm1');
    const item = firestoreStore.get('items/itm1');
    assert.strictEqual(item.currentHolder, null);
    assert.strictEqual(item.currentHolderSince, null);
    assert.strictEqual(item.previousHolder, 'bob@t');
  });

  return { passed, failed, errors };
}

module.exports = { testQrTags };
