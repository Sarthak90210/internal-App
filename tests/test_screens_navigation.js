const assert = require('assert');
const { resetMocks, firestoreStore } = require('./setup');
const React = require('react');

const FolderDetailScreenModule = require('../src/screens/inventory/FolderDetailScreen');
const FolderDetailScreen = FolderDetailScreenModule.default || FolderDetailScreenModule;

const AppNavigatorModule = require('../src/navigation/AppNavigator');
const AppNavigator = AppNavigatorModule.default || AppNavigatorModule;

const AdminStackModule = require('../src/navigation/AdminStack');
const AdminStack = AdminStackModule.default || AdminStackModule;

const InventoryStackModule = require('../src/navigation/InventoryStack');
const InventoryStack = InventoryStackModule.default || InventoryStackModule;

const { useAuthStore } = require('../src/stores/authStore');

async function testScreensNavigation() {
  console.log('\n--- Running Screens & Navigation Tests ---');
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

  // Helper to extract children array from React element
  const getChildrenArray = (element) => {
    const raw = element.props?.children || element.children;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  };

  // 1. FolderDetailScreen Component & Integration Test
  await runTest('FolderDetailScreen component render and subscription setup', async () => {
    const route = { params: { inventoryId: 'inv_100', inventoryName: 'Battery Packs' } };
    const navigation = { setOptions: (opts) => { navigation.lastOptions = opts; } };

    // Invoke screen component function
    const element = FolderDetailScreen({ route, navigation });
    assert.ok(element, 'FolderDetailScreen returned a React node tree');
    assert.strictEqual(navigation.lastOptions.title, 'Battery Packs');
  });

  await runTest('[BUG VERIFICATION 1 IN SCREEN] FolderDetailScreen move modal onConfirm callback throws TypeError on moveInventory', async () => {
    firestoreStore.set('inventories/inv_sub1', { id: 'inv_sub1', name: 'Sub-Inv 1', listId: 'l1', parentInventoryId: 'inv_100' });
    
    // Simulate what FolderDetailScreen onConfirm does for activeTab !== 'items':
    const selectedSet = new Set(['inv_sub1']);
    const dest = { type: 'list', id: 'list_destination', name: 'Target List' };
    const allInvs = [{ id: 'inv_sub1', listId: 'l1' }];
    const { InventoryService } = require('../src/services/inventory');

    // Reproduce exact line 528-532 logic from FolderDetailScreen:
    let caughtErr = null;
    try {
      await Promise.all(
        Array.from(selectedSet).map(invId => 
          InventoryService.moveInventory(
            invId, 
            dest.type === 'list' ? dest.id : (allInvs.find(i => i.id === dest.id)?.listId), 
            dest.type === 'inventory' ? dest.id : null
          )
        )
      );
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Expected FolderDetailScreen move logic to throw TypeError');
    assert.ok(
      caughtErr.message.includes('find is not a function') || caughtErr instanceof TypeError,
      `Expected TypeError on allInvs.find, got: ${caughtErr.message}`
    );
  });

  // 2. AppNavigator Tests
  await runTest('AppNavigator renders loading indicator when isLoading is true', async () => {
    useAuthStore.getState().setLoading(true);
    const element = AppNavigator();
    assert.ok(element, 'AppNavigator rendered');
    assert.strictEqual(element.type.displayName, 'View');
  });

  await runTest('AppNavigator renders Login stack screen when user is null', async () => {
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setUser(null);
    
    const element = AppNavigator();
    assert.ok(element, 'AppNavigator rendered');
    assert.strictEqual(element.type.displayName, 'NavigationContainer');
    
    const children = getChildrenArray(element);
    assert.ok(children.length > 0);
    const stackNav = children[0];
    const screens = getChildrenArray(stackNav);
    assert.strictEqual(screens[0].props.name, 'Login');
  });

  await runTest('AppNavigator renders Main tabs stack screen when user is authenticated', async () => {
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setUser({ email: 'pilot@teamrotor.com' });

    const element = AppNavigator();
    assert.ok(element, 'AppNavigator rendered');
    assert.strictEqual(element.type.displayName, 'NavigationContainer');
    
    const children = getChildrenArray(element);
    const stackNav = children[0];
    const screens = getChildrenArray(stackNav);
    assert.strictEqual(screens[0].props.name, 'Main');
  });

  // 3. AdminStack Tests
  await runTest('AdminStack configuration and registered screen routes', async () => {
    const element = AdminStack();
    assert.ok(element);
    assert.strictEqual(element.type.displayName, 'NativeStackNavigator');
    
    const screens = getChildrenArray(element);
    assert.strictEqual(screens.length, 9, 'Expected 9 admin screens registered');

    const screenNames = screens.map(s => s.props.name);
    assert.deepStrictEqual(screenNames, [
      'AdminDashboard',
      'ManageEvents',
      'ManageGallery',
      'ManageTeam',
      'ManageAchievements',
      'ManageHomeSettings',
      'ManageSponsors',
      'ManageContactMessages',
      'ManageTeamMembers'
    ]);
  });

  // 4. InventoryStack Tests
  await runTest('InventoryStack configuration and registered screen routes', async () => {
    const element = InventoryStack();
    assert.ok(element);
    assert.strictEqual(element.type.displayName, 'NativeStackNavigator');

    const screens = getChildrenArray(element);
    assert.strictEqual(screens.length, 4, 'Expected 4 inventory screens registered');

    const screenNames = screens.map(s => s.props.name);
    assert.deepStrictEqual(screenNames, [
      'InventoryLists',
      'InventoryDetail',
      'FolderDetail',
      'ItemDetail'
    ]);
  });

  return { passed, failed, errors };
}

if (require.main === module) {
  testScreensNavigation();
}

module.exports = { testScreensNavigation };
