import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { 
  Folder, 
  Box, 
  User, 
  Download, 
  CheckSquare, 
  Square, 
  X, 
  ArrowRightLeft 
} from '../../lib/lucideIcons';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';
import { 
  AppSearchBar, 
  AppListItem, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppBadge, 
  AppSkeleton, 
  AppEmptyState 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';
import {
  getRelativeTime,
  getHolderName,
  calculateDescendantItemCount,
  getStatusBadgeVariant,
  resolveStatus,
  toggleInSet,
  toggleSelectAll,
} from '../../lib/inventoryHelpers';

export default function InventoryDetailScreen({ route, navigation }) {
  const { listId, listName } = route.params;
  const [inventories, setInventories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [lists, setLists] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInventories, setSelectedInventories] = useState(new Set());

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newInventoryName, setNewInventoryName] = useState('');
  
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: listName || 'Inventories' });
    const unsubscribeList = InventoryService.subscribeToInventories(listId, (data) => {
      setInventories(data);
      setLoading(false);
    });
    
    const unsubscribeAllInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    const unsubscribeLists = InventoryService.subscribeToLists((data) => setLists(data));
    const unsubscribeAllItems = InventoryService.subscribeToAllItems((data) => setAllItems(data));
    const unsubscribeUsers = UsersService.subscribeToUsers((data) => setUsersList(data));

    return () => {
      unsubscribeList();
      unsubscribeAllInvs();
      unsubscribeLists();
      unsubscribeAllItems();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [listId, listName, navigation]);

  const topLevelInventories = inventories.filter(i => !i.parentInventoryId);

  const toggleSelection = (id) => setSelectedInventories(prev => toggleInSet(prev, id));

  const handleSelectAll = () =>
    setSelectedInventories(prev => toggleSelectAll(prev, topLevelInventories));

  const handleAddInventory = async () => {
    if (!newInventoryName.trim()) return;
    try {
      await InventoryService.addInventory(listId, newInventoryName.trim());
      setIsAddModalVisible(false);
      setNewInventoryName('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const renderNormalView = () => (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={topLevelInventories}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const count = calculateDescendantItemCount(item.id, allInvs, allItems);
        const status = resolveStatus(item);
        const holder = getHolderName(item.currentHolder, usersList);
        const isSelected = selectedInventories.has(item.id);
        const badgeVariant = getStatusBadgeVariant(status);

        const leftIcon = isSelectionMode ? (
          <Pressable onPress={() => toggleSelection(item.id)} style={{ marginRight: 8 }}>
            {isSelected ? (
              <CheckSquare size={20} color={appColors.accent} />
            ) : (
              <Square size={20} color={appColors.textSecondary} />
            )}
          </Pressable>
        ) : (
          <View style={styles.iconBox}>
            <Folder size={18} color="#38BDF8" />
          </View>
        );

        const rightBadge = (
          <AppBadge variant={badgeVariant}>
            {status}
          </AppBadge>
        );

        const desc = `${count} ${count === 1 ? 'item' : 'items'} • Held by ${holder} • ${getRelativeTime(item.createdAt)}`;

        return (
          <AppListItem
            title={item.name || 'Unnamed Folder'}
            description={desc}
            leftIcon={leftIcon}
            rightElement={rightBadge}
            onPress={() => {
              if (isSelectionMode) {
                toggleSelection(item.id);
              } else {
                navigation.navigate('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
              }
            }}
            style={isSelected && { backgroundColor: `${appColors.accent}10`, borderColor: `${appColors.accent}30` }}
          />
        );
      }}
      ListEmptyComponent={
        <AppEmptyState
          title="No storage folders"
          description={`There are currently no folders inside "${listName || 'this list'}".`}
          actionLabel="Create First Folder"
          onAction={() => setIsAddModalVisible(true)}
        />
      }
    />
  );

  const renderSearchResults = () => {
    const q = searchQuery.toLowerCase();
    const validInvs = allInvs.filter(i => i.listId === listId);
    const validInvIds = new Set(validInvs.map(i => i.id));

    const matchedInvs = validInvs.filter(i => i.name?.toLowerCase().includes(q)).map(i => ({ ...i, _type: 'folder' }));
    const matchedItems = allItems.filter(i => validInvIds.has(i.inventoryId) && i.name?.toLowerCase().includes(q)).map(i => ({ ...i, _type: 'item' }));
    
    const heldInvsInList = validInvs.filter(i => i.currentHolder);
    const holderIdentifiers = new Set();
    heldInvsInList.forEach(i => {
      if (i.currentHolder) holderIdentifiers.add(i.currentHolder.toLowerCase());
    });
    const matchedUsers = usersList.filter(u => 
      (holderIdentifiers.has(u.email?.toLowerCase()) || holderIdentifiers.has(u.id?.toLowerCase())) && 
      (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    ).map(u => ({ ...u, _type: 'user' }));
    
    const combined = [...matchedInvs, ...matchedItems, ...matchedUsers];

    return (
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={combined}
        keyExtractor={(item) => item._type + '_' + item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          let icon = <Folder size={18} color="#38BDF8" />;
          let subtitle = "";
          let onPress = () => {};

          if (item._type === 'folder') {
            icon = <Folder size={18} color="#38BDF8" />;
            const parentInv = allInvs.find(i => i.id === item.parentInventoryId);
            subtitle = parentInv ? `Sub-folder • In ${parentInv.name}` : `Folder • In ${listName || 'List'}`;
            onPress = () => navigation.navigate('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
          } else if (item._type === 'item') {
            icon = <Box size={18} color="#A855F7" />;
            const parentInv = allInvs.find(i => i.id === item.inventoryId);
            subtitle = `Item • Qty: ${item.quantity || 0}${parentInv ? ` • In ${parentInv.name}` : ''}`;
            onPress = () => navigation.navigate('ItemDetail', { itemId: item.id, itemData: item });
          } else if (item._type === 'user') {
            icon = <User size={18} color="#10B981" />;
            const userHeldInvs = validInvs.filter(inv => inv.currentHolder?.toLowerCase() === item.email?.toLowerCase() || inv.currentHolder === item.id);
            subtitle = `${item.email || ''} • Holds ${userHeldInvs.length} folders in this list`;
            onPress = () => {
              if (userHeldInvs.length > 0) {
                navigation.navigate('FolderDetail', { inventoryId: userHeldInvs[0].id, inventoryName: userHeldInvs[0].name });
              }
            };
          }

          return (
            <AppListItem
              title={item.name || item.email}
              description={subtitle}
              leftIcon={<View style={styles.iconBox}>{icon}</View>}
              onPress={onPress}
            />
          );
        }}
        ListEmptyComponent={
          <AppEmptyState
            title="No search results"
            description={`No folders, items, or holders matched "${searchQuery}".`}
          />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      {!searchQuery.trim() && (
        <View style={styles.topBar}>
          <View style={styles.topActions}>
            <AppButton 
              variant="secondary" 
              size="sm" 
              onPress={() => setIsExportModalVisible(true)}
              icon={<Download size={14} color={appColors.textPrimary} />}
              style={{ marginRight: 8 }}
            >
              Export
            </AppButton>
            <AppButton 
              variant={isSelectionMode ? "primary" : "secondary"}
              size="sm"
              onPress={() => {
                if (!isSelectionMode) setIsSelectionMode(true);
                else handleSelectAll();
              }}
              icon={isSelectionMode ? <CheckSquare size={14} color="#09090B" /> : <CheckSquare size={14} color={appColors.textPrimary} />}
            >
              {isSelectionMode ? (selectedInventories.size === topLevelInventories.length && topLevelInventories.length > 0 ? 'Deselect All' : 'Select All') : 'Select'}
            </AppButton>
          </View>

          {isSelectionMode && (
            <Pressable onPress={() => { setIsSelectionMode(false); setSelectedInventories(new Set()); }} hitSlop={10}>
              <X size={20} color={appColors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      <AppSearchBar
        placeholder={searchQuery ? `Searching in ${listName || 'this list'}...` : `Search ${listName || 'list'}...`}
        onChangeText={(text) => {
          setSearchQuery(text);
          if (text.trim()) {
            setIsSelectionMode(false);
            setSelectedInventories(new Set());
          }
        }}
        value={searchQuery}
        style={styles.searchBar}
      />
      
      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={64} style={{ marginBottom: 10 }} />
          <AppSkeleton width="100%" height={64} style={{ marginBottom: 10 }} />
          <AppSkeleton width="100%" height={64} />
        </View>
      ) : (
        searchQuery.trim() ? renderSearchResults() : renderNormalView()
      )}

      {!searchQuery.trim() && isSelectionMode && selectedInventories.size > 0 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkText}>{selectedInventories.size} folders selected</Text>
          <AppButton 
            variant="primary" 
            size="sm" 
            onPress={() => setIsMoveModalVisible(true)}
            icon={<ArrowRightLeft size={14} color="#09090B" />}
          >
            Move Selected
          </AppButton>
        </View>
      )}

      <MoveDestinationModal
        visible={isMoveModalVisible}
        onDismiss={() => setIsMoveModalVisible(false)}
        lists={lists}
        inventories={allInvs}
        allowedTypes={['list', 'inventory']}
        invalidTargets={Array.from(selectedInventories).map(id => `inventory:${id}`)}
        onConfirm={async (dest) => {
          setIsMoveModalVisible(false);
          try {
            await Promise.all(
              Array.from(selectedInventories).map(invId => 
                InventoryService.moveInventory(invId, dest, allInvs)
              )
            );
            setIsSelectionMode(false);
            setSelectedInventories(new Set());
          } catch (e) {
            Alert.alert('Move Failed', 'Could not move the selected items. Please try again.');
          }
        }}
      />

      <ExportModal 
        visible={isExportModalVisible} 
        onDismiss={() => setIsExportModalVisible(false)} 
        listId={listId} 
      />

      {!isSelectionMode && !searchQuery.trim() && (
        <AppFAB
          label="New Folder"
          onPress={() => setIsAddModalVisible(true)}
        />
      )}

      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title="Create Storage Folder"
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
              onPress={handleAddInventory} 
              disabled={!newInventoryName.trim()} 
              style={{ flex: 1 }}
            >
              Create Folder
            </AppButton>
          </View>
        }
      >
        <Text style={styles.modalHelper}>
          Create a storage folder or sub-compartment to group related items together.
        </Text>
        <AppInput
          label="Folder Name"
          value={newInventoryName}
          onChangeText={setNewInventoryName}
          placeholder="e.g. Flight Controllers & ESCs"
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    marginHorizontal: appSpacing.xl,
    marginVertical: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `${appColors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 8,
  },
  bulkActionBar: {
    position: 'absolute',
    // Clear the floating bottom nav (absolute, bottom:24 + height:62 = 86px)
    // so the Move bar isn't hidden behind it.
    bottom: 96,
    left: 20,
    right: 20,
    backgroundColor: appColors.elevatedSurface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: appRadius.lg,
    paddingHorizontal: appSpacing.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  bulkText: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
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

