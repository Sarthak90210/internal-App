const assert = require('assert');
const { resetMocks, firestoreStore, setMockDocMissing, setMockClaims, setMockCurrentUser } = require('./setup');

const { InventoryService } = require('../src/services/inventory');
const { apiPost, uploadFile, logAdminAction, fetchAdmins, syncUserPermissions } = require('../src/services/adminApi');
const { GalleryService } = require('../src/services/gallery');
const { SponsorsService } = require('../src/services/sponsors');
const { AuthService } = require('../src/services/auth');
const { EventsService } = require('../src/services/events');
const { AchievementsService } = require('../src/services/achievements');
const { useAuthStore } = require('../src/stores/authStore');

async function testServices() {
  console.log('\n--- Running Service Tests ---');
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

  // 1. InventoryService Tests
  await runTest('InventoryService addList and archiveList', async () => {
    useAuthStore.getState().setUser({ email: 'admin@teamrotor.com' });
    const docRef = await InventoryService.addList('Main Inventory');
    assert.ok(docRef.id);
    
    const stored = firestoreStore.get(`inventory_lists/${docRef.id}`);
    assert.strictEqual(stored.name, 'Main Inventory');
    assert.strictEqual(stored.createdBy, 'admin@teamrotor.com');

    await InventoryService.archiveList(docRef.id, true);
    const updated = firestoreStore.get(`inventory_lists/${docRef.id}`);
    assert.strictEqual(updated.isArchived, true);
    assert.ok(updated.archivedAt);
  });

  await runTest('InventoryService moveInventory with valid destination object (Happy Path)', async () => {
    firestoreStore.set('inventories/inv_1', { name: 'Motors', listId: 'list_1', parentInventoryId: null });
    const destination = { type: 'list', id: 'list_2', name: 'Secondary List' };
    
    await InventoryService.moveInventory('inv_1', destination, []);
    const updated = firestoreStore.get('inventories/inv_1');
    assert.strictEqual(updated.listId, 'list_2');
    assert.strictEqual(updated.parentInventoryId, null);
  });

  // Regression: FolderDetailScreen used to call this as
  // (invId, stringListId, stringParentId), which crashed on allInvs.find.
  // Both call sites now pass (invId, destinationObject, allInvs).
  await runTest('InventoryService moveInventory into a parent inventory (FolderDetailScreen path)', async () => {
    firestoreStore.set('inventories/inv_1', { name: 'Motors', listId: 'list_1', parentInventoryId: null });
    const allInvs = [
      { id: 'inv_1', name: 'Motors', listId: 'list_1' },
      { id: 'inv_2', name: 'Spares', listId: 'list_2' },
    ];
    const destination = { type: 'inventory', id: 'inv_2', name: 'Spares' };

    await InventoryService.moveInventory('inv_1', destination, allInvs);

    const updated = firestoreStore.get('inventories/inv_1');
    assert.strictEqual(updated.parentInventoryId, 'inv_2', 'should be reparented under the target inventory');
    assert.strictEqual(updated.listId, 'list_2', 'should inherit the target inventory\'s listId');
  });

  // 2. AdminApi Tests
  await runTest('adminApi apiPost formatting and token attachment', async () => {
    const postRes = await apiPost('/api/test-route', { key: 'val' });
    assert.strictEqual(postRes.ok, true);
    assert.strictEqual(global.fetchCalls.length, 1);
    assert.strictEqual(global.fetchCalls[0].options.headers['Authorization'], 'Bearer mock-id-token-123');
  });

  await runTest('adminApi uploadFile does not explicitly set Content-Type header', async () => {
    await uploadFile('file://path/to/image.png', 'events');
    const lastFetch = global.fetchCalls[global.fetchCalls.length - 1];
    const headers = lastFetch.options.headers;
    
    assert.strictEqual(headers['Content-Type'], undefined, 
      'Expected Content-Type to be undefined so browser/fetch can automatically set boundary for FormData'
    );
  });

  // ── Upload folder contract ───────────────────────────────────────────────
  // The backend sanitises the caller-supplied folder to [a-zA-Z0-9/_-] and then,
  // for non-admins, requires it to equal their own profile folder. An email's
  // '@' and '.' do not survive that, so a folder built as `users/${email}`
  // could never match and every non-admin profile upload was rejected 403.
  // These tests pin the client to the same normalisation the server uses.
  const { sanitizeFolder, ownProfileFolder, buildFolder } = require('../src/lib/mediaUpload');

  // Mirror of the server's sanitiser (Team-RotorFPV-Website/server/index.js).
  const serverSanitize = (folder) => (folder || '').replace(/[^a-zA-Z0-9/_-]/g, '');

  await runTest('mediaUpload sanitizeFolder matches the server sanitiser', async () => {
    for (const input of [
      'users/teamrotorfpv@vit.ac.in',
      'events/Upcoming/Drone-Race-2026',
      'sponsors/Acme Corp. & Co!',
      'gallery',
      '',
      null,
    ]) {
      assert.strictEqual(sanitizeFolder(input), serverSanitize(input), `mismatch for input: ${input}`);
    }
  });

  await runTest('mediaUpload ownProfileFolder survives server sanitisation (403 regression)', async () => {
    const email = 'TeamRotorFPV@vit.ac.in';
    const clientFolder = ownProfileFolder(email);

    // What the server computes for the same user.
    const serverExpected = `users/${serverSanitize(email.toLowerCase())}`;

    // The server sanitises whatever the client sent, then compares.
    assert.strictEqual(
      serverSanitize(clientFolder),
      serverExpected,
      'sanitised client folder must equal the server-side expected folder'
    );

    // And the old, broken construction must NOT satisfy it — proving the test
    // would have caught the original bug.
    const legacyFolder = `users/${email.toLowerCase()}`;
    assert.notStrictEqual(
      serverSanitize(legacyFolder),
      `users/${email.toLowerCase()}`,
      'raw-email folder cannot survive sanitisation — this was the 403'
    );
  });

  await runTest('mediaUpload buildFolder strips unsafe characters from user input', async () => {
    assert.strictEqual(buildFolder('events', 'Upcoming', 'Drone Race 2026'), 'events/Upcoming/Drone-Race-2026');
    // '.', '&' and '!' are dropped; the resulting '-' run is collapsed.
    assert.strictEqual(buildFolder('sponsors', '  Acme Corp. & Co!  '), 'sponsors/Acme-Corp-Co');
    assert.strictEqual(buildFolder('achievements', null), 'achievements');
    // Result must always be a no-op under the server's sanitiser.
    const built = buildFolder('events', 'Live', 'Sürprise Event #3');
    assert.strictEqual(serverSanitize(built), built, 'buildFolder output must already be server-safe');
  });

  await runTest('adminApi syncUserPermissions admin promotion and demotion', async () => {
    const allTags = [
      { id: 't1', grantsAdmin: true, grantsSuperAdmin: false },
      { id: 't2', grantsAdmin: true, grantsSuperAdmin: true }
    ];
    const currentAdmins = [];

    await syncUserPermissions('member@teamrotor.com', ['t1'], allTags, currentAdmins);
    const postCall = global.fetchCalls.find(c => c.url.includes('/api/setAdmin'));
    assert.ok(postCall, 'Expected call to /api/setAdmin');
  });

  // 3. GalleryService Tests
  await runTest('GalleryService subscribeToGallery and CRUD operations', async () => {
    firestoreStore.set('gallery/g1', { caption: 'Flight 1', order: 1 });
    let galleryData = [];
    GalleryService.subscribeToGallery(data => { galleryData = data; });
    assert.strictEqual(galleryData.length, 1);

    const docRef = await GalleryService.addGalleryItem({ caption: 'Flight 2', order: 2 }, 'admin@teamrotor.com');
    assert.ok(docRef.id);
  });

  // Regression: this used updateDoc, which throws when 'settings/gallery' has
  // never been written. It now uses setDoc+merge and creates the doc.
  await runTest('GalleryService updateGallerySettings creates the settings doc when missing', async () => {
    await GalleryService.updateGallerySettings({ heroImageUrl: 'https://img.com/hero.jpg' }, 'admin@teamrotor.com');

    const stored = firestoreStore.get('settings/gallery');
    assert.ok(stored, 'settings/gallery should have been created');
    assert.strictEqual(stored.heroImageUrl, 'https://img.com/hero.jpg');
    assert.strictEqual(stored.updatedBy, 'admin@teamrotor.com');
  });

  // 4. SponsorsService Tests
  await runTest('SponsorsService subscribeToSponsors and CRUD operations', async () => {
    firestoreStore.set('sponsors/s1', { name: 'Sponsor A', order: 1 });
    let sponsors = [];
    SponsorsService.subscribeToSponsors(data => { sponsors = data; });
    assert.strictEqual(sponsors.length, 1);

    const docRef = await SponsorsService.addSponsor({ name: 'Sponsor B', order: 2 }, 'admin@teamrotor.com');
    assert.ok(docRef.id);
  });

  // Regression: same missing-singleton-doc problem as the gallery settings.
  await runTest('SponsorsService updateSponsorSettings creates the settings doc when missing', async () => {
    await SponsorsService.updateSponsorSettings({ title: 'New Sponsors Title' }, 'admin@teamrotor.com');

    const stored = firestoreStore.get('settings/sponsors');
    assert.ok(stored, 'settings/sponsors should have been created');
    assert.strictEqual(stored.title, 'New Sponsors Title');
    assert.strictEqual(stored.updatedBy, 'admin@teamrotor.com');
  });

  // 5. AuthService Tests
  await runTest('AuthService signInWithGoogleToken authorized admin user', async () => {
    setMockClaims({ admin: true });
    firestoreStore.set('users/admin@teamrotor.com', { isActive: true, isArchived: false });
    
    const user = await AuthService.signInWithGoogleToken('valid-google-id-token');
    assert.strictEqual(user.email, 'test@teamrotor.com');
    assert.strictEqual(useAuthStore.getState().roles.admin, true);
  });

  await runTest('AuthService signInWithGoogleToken denies unauthorized non-admin user', async () => {
    setMockClaims({ admin: false });
    // User doc missing or inactive
    setMockCurrentUser({
      email: 'unauthorized@example.com',
      getIdToken: async () => 'mock-token',
      getIdTokenResult: async () => ({ claims: {} })
    });

    let caughtErr = null;
    try {
      await AuthService.signInWithGoogleToken('token');
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Expected sign-in rejection for unauthorized user');
    assert.ok(caughtErr.message.includes('Access Denied'));
  });

  await runTest('AuthService logout resets auth state', async () => {
    await AuthService.logout();
    assert.strictEqual(useAuthStore.getState().user, null);
  });

  // 6. EventsService Tests
  await runTest('EventsService subscribeToEvents, addEvent, updateEvent, and deleteEvent', async () => {
    const eventRef = await EventsService.addEvent({ name: 'FPV Championship 2026', status: 'upcoming' }, 'admin@teamrotor.com');
    assert.ok(eventRef.id);

    await EventsService.updateEvent(eventRef.id, { image: 'old.jpg' }, { name: 'FPV Championship 2026', image: 'new.jpg' }, 'admin@teamrotor.com');
    const updated = firestoreStore.get(`events/${eventRef.id}`);
    assert.strictEqual(updated.image, 'new.jpg');

    await EventsService.deleteEvent({ id: eventRef.id, name: 'FPV Championship 2026', image: 'new.jpg' });
    assert.strictEqual(firestoreStore.has(`events/${eventRef.id}`), false);
  });

  // 8. AchievementsService Tests
  await runTest('AchievementsService addAchievement, updateAchievement, and deleteAchievement', async () => {
    const achRef = await AchievementsService.addAchievement({ title: 'National Winners 2025', rank: 1 }, 'admin@teamrotor.com');
    assert.ok(achRef.id);

    await AchievementsService.updateAchievement(achRef.id, {}, { title: 'National Champions 2025', rank: 1 }, 'admin@teamrotor.com');
    const updated = firestoreStore.get(`achievements/${achRef.id}`);
    assert.strictEqual(updated.title, 'National Champions 2025');

    await AchievementsService.deleteAchievement({ id: achRef.id, title: 'National Champions 2025' });
    assert.strictEqual(firestoreStore.has(`achievements/${achRef.id}`), false);
  });

  return { passed, failed, errors };
}

if (require.main === module) {
  testServices();
}

module.exports = { testServices };
