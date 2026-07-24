const assert = require('assert');
const { resetMocks, firestoreStore } = require('./setup');

const { useAuthStore } = require('../src/stores/authStore');
const { useInventoryStore } = require('../src/stores/inventoryStore');
const { useTagStore } = require('../src/stores/tagStore');

async function testStores() {
  console.log('\n--- Running Store Tests ---');
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
      console.log(`    Error: ${err.message}`);
      failed++;
      errors.push({ test: name, error: err });
    }
  };

  // AuthStore tests
  await runTest('authStore initial state', async () => {
    const state = useAuthStore.getState();
    assert.strictEqual(state.user, null);
    assert.deepStrictEqual(state.roles, {
      admin: false,
      superAdmin: false,
      inventory: false,
      board: false,
      media: false,
    });
    assert.strictEqual(state.isLoading, true);
  });

  await runTest('authStore setUser and setRoles state updates', async () => {
    useAuthStore.getState().setUser({ email: 'user@teamrotor.com' });
    useAuthStore.getState().setRoles({ admin: true, inventory: true });
    
    const state = useAuthStore.getState();
    assert.strictEqual(state.user.email, 'user@teamrotor.com');
    assert.strictEqual(state.roles.admin, true);
    assert.strictEqual(state.roles.inventory, true);
    assert.strictEqual(state.roles.superAdmin, false);
  });

  await runTest('authStore hasPermission checks logic for admin, superAdmin, and custom roles', async () => {
    useAuthStore.getState().setRoles({ admin: false, superAdmin: false, inventory: true });
    assert.strictEqual(useAuthStore.getState().hasPermission('inventory'), true);
    assert.strictEqual(useAuthStore.getState().hasPermission('board'), false);

    // Regular admin has permissions except superAdmin
    useAuthStore.getState().setRoles({ admin: true, superAdmin: false });
    assert.strictEqual(useAuthStore.getState().hasPermission('board'), true);
    assert.strictEqual(useAuthStore.getState().hasPermission('superAdmin'), false);

    // SuperAdmin has all permissions
    useAuthStore.getState().setRoles({ admin: true, superAdmin: true });
    assert.strictEqual(useAuthStore.getState().hasPermission('superAdmin'), true);
    assert.strictEqual(useAuthStore.getState().hasPermission('board'), true);
  });

  await runTest('authStore logout resets user and roles', async () => {
    useAuthStore.getState().setUser({ email: 'test@teamrotor.com' });
    useAuthStore.getState().setRoles({ admin: true });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    assert.strictEqual(state.user, null);
    assert.strictEqual(state.roles.admin, false);
  });

  // InventoryStore tests
  await runTest('inventoryStore searchQuery and isSyncing state updates', async () => {
    const state = useInventoryStore.getState();
    assert.strictEqual(state.searchQuery, '');
    assert.strictEqual(state.isSyncing, false);

    useInventoryStore.getState().setSearchQuery('drone propeller');
    useInventoryStore.getState().setSyncing(true);

    assert.strictEqual(useInventoryStore.getState().searchQuery, 'drone propeller');
    assert.strictEqual(useInventoryStore.getState().isSyncing, true);
  });

  // TagStore tests
  await runTest('tagStore initTags subscribes and populates tags from firestore', async () => {
    firestoreStore.set('tags/tag_1', { name: 'Electronics', color: '#ff0000' });
    useTagStore.getState().cleanup();

    useTagStore.getState().initTags();
    const state = useTagStore.getState();
    assert.strictEqual(state.initialized, true);
    assert.strictEqual(state.loading, false);
    assert.strictEqual(state.tags.length, 1);
    assert.strictEqual(state.tags[0].name, 'Electronics');

    useTagStore.getState().cleanup();
    assert.strictEqual(useTagStore.getState().initialized, false);
    assert.strictEqual(useTagStore.getState().tags.length, 0);
  });

  return { passed, failed, errors };
}

if (require.main === module) {
  testStores();
}

module.exports = { testStores };
