import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import {
  Folder,
  Archive,
  ArchiveRestore,
  Box,
  User,
  Layers,
  ShieldAlert,
  Table
} from '../../lib/lucideIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import InventoryScanButton from '../../components/InventoryScanButton';
import { useAuthStore } from '../../stores/authStore';
import { buildInventoryPath } from '../../lib/inventoryHelpers';
import { 
  AppSearchBar, 
  AppChip, 
  AppListItem, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppSkeleton, 
  AppEmptyState 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

// Mirrors the inventory website's OpenSheetButton exactly: it reads the
// `sheetUrl` and `enabled` fields off settings/google_sheets, only shows when
// the integration is enabled, and falls back to the generic Sheets URL when no
// specific link is set.
const SHEETS_FALLBACK_URL = 'https://docs.google.com/spreadsheets';

export default function InventoryListsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetEnabled, setSheetEnabled] = useState(false);

  const { hasPermission, user } = useAuthStore();
  const hasInventoryPermission = hasPermission('inventory');
  const myEmail = (user?.email || '').toLowerCase();

  // Live-track the Google Sheets config, exactly like the website's
  // OpenSheetButton — the button appears only while the integration is enabled.
  useEffect(() => {
    if (!hasInventoryPermission) return;
    const unsub = onSnapshot(
      doc(db, 'settings', 'google_sheets'),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setSheetUrl(data.sheetUrl || '');
        setSheetEnabled(data.enabled || false);
      },
      () => {
        setSheetEnabled(false);
      }
    );
    return () => unsub();
  }, [hasInventoryPermission]);

  const handleOpenSheet = async () => {
    try {
      await Linking.openURL(sheetUrl || SHEETS_FALLBACK_URL);
    } catch (e) {
      Alert.alert('Cannot Open', 'The linked Google Sheet could not be opened.');
    }
  };

  useEffect(() => {
    if (!hasInventoryPermission) {
      setLoading(false);
      return;
    }

    const unsubscribeLists = InventoryService.subscribeToLists((data) => {
      setLists(data);
      setLoading(false);
    });
    const unsubscribeInvs = InventoryService.subscribeToAllInventories((data) => {
      setAllInvs(data);
    });
    const unsubscribeItems = InventoryService.subscribeToAllItems((data) => {
      setAllItems(data);
    });
    const unsubscribeUsers = UsersService.subscribeToUsers((data) => {
      setUsersList(data);
    });

    return () => {
      if (unsubscribeLists) unsubscribeLists();
      if (unsubscribeInvs) unsubscribeInvs();
      if (unsubscribeItems) unsubscribeItems();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [hasInventoryPermission]);

  const handleAddList = async () => {
    if (!newListName.trim()) return;
    try {
      await InventoryService.addList(newListName.trim());
      setIsAddModalVisible(false);
      setNewListName('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create list');
    }
  };

  const handleArchiveToggle = (list, isArchived) => {
    Alert.alert(
      isArchived ? 'Archive List' : 'Restore List', 
      `Are you sure you want to ${isArchived ? 'archive' : 'restore'} "${list.name}"?`, 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: isArchived ? 'Archive' : 'Restore', 
          style: isArchived ? 'destructive' : 'default', 
          onPress: async () => {
            try {
              await InventoryService.archiveList(list.id, isArchived);
            } catch (e) {
              Alert.alert('Error', 'Failed to update list status');
            }
          }
        }
      ]
    );
  };

  const handleDeleteList = (list) => {
    Alert.alert(
      'Delete List', 
      `Are you sure you want to permanently delete "${list.name}"? All folders and items inside will be deleted.`, 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await InventoryService.deleteList(list.id);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete list');
            }
          }
        }
      ]
    );
  };

  const filteredLists = lists.filter(l =>
    (activeTab === 'active' ? !l.isArchived : l.isArchived)
  );

  // Folders currently checked out to the signed-in user. currentHolder is stored
  // as the holder's (lowercased) email — the same match the global search uses.
  // Guard against orphaned folders whose parent list no longer exists.
  const listIdSet = new Set(lists.map(l => l.id));
  const myHeldInvs = myEmail
    ? allInvs.filter(inv =>
        listIdSet.has(inv.listId) &&
        inv.currentHolder?.toLowerCase() === myEmail
      )
    : [];

  const renderHeldByYou = () => {
    if (myHeldInvs.length === 0) return null;
    return (
      <View style={styles.heldSection}>
        <Text style={styles.heldTitle}>
          Held by You · {myHeldInvs.length}
        </Text>
        {myHeldInvs.map(inv => (
          <AppListItem
            key={inv.id}
            title={inv.name || 'Unnamed Folder'}
            description={`Folder · In ${lists.find(l => l.id === inv.listId)?.name || 'Unknown List'}`}
            leftIcon={
              <View style={styles.heldIconBox}>
                <Box size={18} color={appColors.accent} />
              </View>
            }
            onPress={() => navigation.navigate('FolderDetail', { inventoryId: inv.id, inventoryName: inv.name })}
          />
        ))}
      </View>
    );
  };

  const getArchivedDescription = (list) => {
    if (!list.isArchived) return undefined;
    let desc = '';
    if (list.archivedAt) {
      const date = list.archivedAt.toDate ? list.archivedAt.toDate() : new Date(list.archivedAt);
      desc += `Archived ${date.toLocaleDateString()}`;
    }
    if (list.archivedBy) {
      const user = usersList.find(u => u.id === list.archivedBy);
      desc += desc ? ` by ${user ? user.name : list.archivedBy}` : `Archived by ${user ? user.name : list.archivedBy}`;
    }
    return desc || 'Archived collection';
  };

  const renderNormalView = () => (
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filteredLists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {renderHeldByYou()}
            <View style={styles.filterRow}>
              <AppChip
                selected={activeTab === 'active'}
                onPress={() => setActiveTab('active')}
                style={{ marginRight: 8 }}
              >
                Active Lists
              </AppChip>
              <AppChip
                selected={activeTab === 'archived'}
                onPress={() => setActiveTab('archived')}
              >
                Archived
              </AppChip>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const invCount = allInvs.filter(i => i.listId === item.id).length;
          const desc = item.isArchived 
            ? getArchivedDescription(item) 
            : `${invCount} ${invCount === 1 ? 'folder' : 'folders'}`;

          const rightAction = (
            <Pressable 
              onPress={() => handleArchiveToggle(item, !item.isArchived)}
              hitSlop={10}
              style={styles.archiveBtn}
            >
              {item.isArchived ? (
                <ArchiveRestore size={18} color={appColors.textSecondary} />
              ) : (
                <Archive size={18} color={appColors.textSecondary} />
              )}
            </Pressable>
          );

          return (
            <AppListItem
              title={item.name || 'Unnamed List'}
              description={desc}
              leftIcon={
                <View style={[styles.iconBox, item.isArchived && { backgroundColor: appColors.elevatedSurface }]}>
                  <Layers size={18} color={item.isArchived ? appColors.textMuted : appColors.primary} />
                </View>
              }
              rightElement={rightAction}
              onPress={() => navigation.navigate('InventoryDetail', { listId: item.id, listName: item.name })}
              onDelete={() => handleDeleteList(item)}
              style={item.isArchived && { opacity: 0.7 }}
            />
          );
        }}
        ListEmptyComponent={
          <AppEmptyState
            title={`No ${activeTab} lists`}
            description={`There are currently no ${activeTab} inventory lists created in the workspace.`}
            actionLabel={activeTab === 'active' ? "Create First List" : undefined}
            onAction={activeTab === 'active' ? () => setIsAddModalVisible(true) : undefined}
          />
        }
      />
  );

  const renderSearchResults = () => {
    const q = searchQuery.toLowerCase();
    
    const listIds = new Set(lists.map(l => l.id));
    const validInvs = allInvs.filter(i => listIds.has(i.listId));
    const validInvIds = new Set(validInvs.map(i => i.id));

    const matchedLists = lists.filter(l => l.name?.toLowerCase().includes(q)).map(l => ({ ...l, _type: 'list' }));
    const matchedInvs = validInvs.filter(i => i.name?.toLowerCase().includes(q)).map(i => ({ ...i, _type: 'folder' }));
    const matchedItems = allItems.filter(i => validInvIds.has(i.inventoryId) && i.name?.toLowerCase().includes(q)).map(i => ({ ...i, _type: 'item' }));
    const matchedUsers = usersList.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)).map(u => ({ ...u, _type: 'user' }));
    
    const combined = [...matchedLists, ...matchedInvs, ...matchedItems, ...matchedUsers];

    return (
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={combined}
        keyExtractor={(item) => item._type + '_' + item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          let icon = <Layers size={18} color={appColors.primary} />;
          let subtitle = "";
          let onPress = () => {};

          if (item._type === 'list') {
            icon = <Layers size={18} color={appColors.primary} />;
            subtitle = "Inventory List";
            onPress = () => navigation.navigate('InventoryDetail', { listId: item.id, listName: item.name });
          } else if (item._type === 'folder') {
            icon = <Folder size={18} color="#38BDF8" />;
            // Full path of the folder's parent (everything above the folder itself).
            const parentPath = buildInventoryPath(item.parentInventoryId, allInvs, lists);
            const listName = lists.find(l => l.id === item.listId)?.name || 'Unknown List';
            subtitle = `Folder • ${parentPath || listName}`;
            onPress = () => navigation.navigate('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
          } else if (item._type === 'item') {
            icon = <Box size={18} color="#A855F7" />;
            // Full location path: List / Folder / Sub-folder that holds the item.
            const path = buildInventoryPath(item.inventoryId, allInvs, lists);
            subtitle = `Qty: ${item.quantity || 0}${path ? ` • ${path}` : ''}`;
            onPress = () => navigation.navigate('ItemDetail', { itemId: item.id, itemData: item });
          } else if (item._type === 'user') {
            icon = <User size={18} color="#10B981" />;
            const heldInvs = allInvs.filter(inv =>
              inv.currentHolder?.toLowerCase() === item.email?.toLowerCase() ||
              inv.currentHolder === item.id
            );
            subtitle = `${item.email || ''} • Holds ${heldInvs.length} folders`;
            onPress = () => {
              if (heldInvs.length > 0) {
                navigation.navigate('FolderDetail', { inventoryId: heldInvs[0].id, inventoryName: heldInvs[0].name });
              }
            };
          }

          return (
            <AppListItem
              title={item.name}
              description={subtitle}
              leftIcon={<View style={styles.iconBox}>{icon}</View>}
              onPress={onPress}
            />
          );
        }}
        ListEmptyComponent={
          <AppEmptyState
            title="No matches found"
            description={`We couldn't find any lists, folders, items, or users matching "${searchQuery}".`}
          />
        }
      />
    );
  };

  if (!hasInventoryPermission) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ShieldAlert size={64} color={appColors.danger} style={{ marginBottom: 16 }} />
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedDesc}>
          You do not have permission to view or manage inventory resources. Please contact an administrator if you need access.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.hero}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.heroTitle}>Inventory</Text>
          <Text style={styles.heroSub}>Manage equipment lists and storage folders</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <InventoryScanButton navigation={navigation} surface="home" label="Scan" />
          {sheetEnabled && (
            <Pressable onPress={handleOpenSheet} style={styles.sheetBtn} hitSlop={8}>
              <Table size={16} color={appColors.accent} />
              <Text style={styles.sheetBtnText}>Open Sheet</Text>
            </Pressable>
          )}
        </View>
      </View>

      <AppSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchQuery ? "Global Search..." : `Search ${activeTab} lists globally...`}
        style={styles.searchBar}
      />
      
      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={68} style={{ marginBottom: 10 }} />
          <AppSkeleton width="100%" height={68} style={{ marginBottom: 10 }} />
          <AppSkeleton width="100%" height={68} />
        </View>
      ) : (
        searchQuery.trim() ? renderSearchResults() : renderNormalView()
      )}

      {activeTab === 'active' && !searchQuery.trim() && (
        <AppFAB
          label="New List"
          onPress={() => setIsAddModalVisible(true)}
        />
      )}

      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title="Create Inventory List"
        footer={
          <View style={styles.modalFooter}>
            <AppButton 
              variant="ghost" 
              onPress={() => setIsAddModalVisible(false)} 
              style={{ flex: 1, marginRight: 8 }}
            >
              Cancel
            </AppButton>
            <AppButton 
              variant="primary" 
              onPress={handleAddList} 
              disabled={!newListName.trim()} 
              style={{ flex: 1 }}
            >
              Create List
            </AppButton>
          </View>
        }
      >
        <Text style={styles.modalHelper}>
          Give your inventory collection a descriptive name (e.g., Electronics, Drone Frames, Field Gear).
        </Text>
        <AppInput
          label="List Name"
          value={newListName}
          onChangeText={setNewListName}
          placeholder="e.g. Drone Spare Parts"
          autoFocus
        />
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: appRadius.pill,
    borderWidth: 1,
    borderColor: appColors.accent,
    backgroundColor: `${appColors.accent}14`,
  },
  sheetBtnText: {
    ...appTypography.caption,
    fontWeight: '700',
    color: appColors.accent,
  },
  heroTitle: {
    ...appTypography.pageTitle, 
    fontSize: 28, 
    color: appColors.textPrimary,
  },
  heroSub: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 2,
  },
  searchBar: {
    marginHorizontal: appSpacing.xl,
    marginBottom: appSpacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: appSpacing.xl,
    paddingBottom: 14,
  },
  heldSection: {
    paddingHorizontal: appSpacing.xl,
    paddingBottom: 14,
  },
  heldTitle: {
    ...appTypography.metadata,
    textTransform: 'uppercase',
    color: appColors.textMuted,
    marginBottom: 10,
  },
  heldIconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `${appColors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `${appColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBtn: {
    padding: 8,
    marginRight: 4,
  },
  loadingWrap: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
  },
  deniedTitle: {
    ...appTypography.sectionTitle,
    fontSize: 20,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  deniedDesc: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: 'center',
  },
  modalHelper: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

