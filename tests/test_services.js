const assert = require('assert');
const { resetMocks, firestoreStore, setMockDocMissing, setMockClaims, setMockCurrentUser } = require('./setup');

const { InventoryService } = require('../src/services/inventory');
const { apiPost, apiGet, uploadFile, logAdminAction, fetchAdmins, syncUserPermissions } = require('../src/services/adminApi');
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

  await runTest('[BUG VERIFICATION 1] InventoryService moveInventory fails when passed string parameters from FolderDetailScreen', async () => {
    firestoreStore.set('inventories/inv_1', { name: 'Motors', listId: 'list_1' });
    
    // FolderDetailScreen passes (invId, stringListId, stringParentId)
    // moveInventory accesses destination.type (which is undefined on string) and then allInvs.find (where allInvs is string or null)
    let caughtError = null;
    try {
      await InventoryService.moveInventory('inv_1', 'list_2', 'parent_inv_1');
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Expected moveInventory to fail with invalid argument types');
    assert.ok(
      caughtError.message.includes('find is not a function') || caughtError instanceof TypeError,
      `Expected TypeError on allInvs.find, got: ${caughtError.message}`
    );
  });

  // 2. AdminApi Tests
  await runTest('adminApi apiPost and apiGet formatting and token attachment', async () => {
    const postRes = await apiPost('/api/test-route', { key: 'val' });
    assert.strictEqual(postRes.ok, true);
    assert.strictEqual(global.fetchCalls.length, 1);
    assert.strictEqual(global.fetchCalls[0].options.headers['Authorization'], 'Bearer mock-id-token-123');

    const getRes = await apiGet('/api/test-get');
    assert.strictEqual(getRes.ok, true);
  });

  await runTest('[BUG VERIFICATION 2] adminApi uploadFile explicitly sets Content-Type header', async () => {
    await uploadFile('file://path/to/image.png', 'events');
    const lastFetch = global.fetchCalls[global.fetchCalls.length - 1];
    const headers = lastFetch.options.headers;
    
    assert.strictEqual(headers['Content-Type'], 'multipart/form-data', 
      'BUG CONFIRMED: Content-Type is explicitly set to multipart/form-data without boundary parameter'
    );
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

  await runTest('[BUG VERIFICATION 3A] GalleryService updateGallerySettings fails with updateDoc when doc is missing', async () => {
    // Document 'settings/gallery' is missing in fresh database
    let caughtErr = null;
    try {
      await GalleryService.updateGallerySettings({ heroImageUrl: 'https://img.com/hero.jpg' }, 'admin@teamrotor.com');
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Expected updateGallerySettings to throw error on missing document');
    assert.ok(
      caughtErr.message.includes('No document to update') || caughtErr.code === 'not-found',
      `Expected Firestore missing doc error, got: ${caughtErr.message}`
    );
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

  await runTest('[BUG VERIFICATION 3B] SponsorsService updateSponsorSettings fails with updateDoc when doc is missing', async () => {
    // Document 'settings/sponsors' is missing in clean environment
    let caughtErr = null;
    try {
      await SponsorsService.updateSponsorSettings({ title: 'New Sponsors Title' }, 'admin@teamrotor.com');
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Expected updateSponsorSettings to throw error on missing document');
    assert.ok(
      caughtErr.message.includes('No document to update') || caughtErr.code === 'not-found',
      `Expected Firestore missing doc error, got: ${caughtErr.message}`
    );
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
