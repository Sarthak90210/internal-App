import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { 
  Folder, 
  Box, 
  User, 
  Download, 
  CheckSquare, 
  Square, 
  X, 
  ArrowRightLeft, 
  MoreVertical, 
  Trash2, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle 
} from '../../lib/lucideIcons';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';
import { 
  AppCard, 
  AppSection, 
  AppSearchBar, 
  AppListItem, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppBadge, 
  AppChip, 
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

export default function FolderDetailScreen({ route, navigation }) {
  const { user } = useAuthStore();
  const { inventoryId, inventoryName } = route.params;
  const [items, setItems] = useState([]);
  const [subInventories, setSubInventories] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [lists, setLists] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState(new Set());

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCategory, setNewCategory] = useState('');

  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportVisible, setIsExportVisible] = useState(false);
  const [isActionsModalVisible, setIsActionsModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: inventoryName || 'Folder' });
    const unsubscribeItems = InventoryService.subscribeToItems(inventoryId, (data) => {
      setItems(data);
      // Clear the skeleton as soon as real data lands, rather than on a timer.
      setLoading(false);
    });
    const unsubscribeSubInvs = InventoryService.subscribeToSubInventories(inventoryId, (data) => setSubInventories(data));
    const unsubscribeAllInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    const unsubscribeLists = InventoryService.subscribeToLists((data) => setLists(data));
    const unsubscribeAllItems = InventoryService.subscribeToAllItems((data) => setAllItems(data));
    const unsubscribeHistory = InventoryService.subscribeToHistory(inventoryId, (data) => setHistory(data));
    const unsubscribeUsers = UsersService.subscribeToUsers((data) => setUsersList(data));

    return () => {
      unsubscribeItems();
      unsubscribeSubInvs();
      unsubscribeAllInvs();
      unsubscribeLists();
      unsubscribeAllItems();
      unsubscribeHistory();
      unsubscribeUsers();
    };
  }, [inventoryId, inventoryName, navigation]);

  const currentInventory = allInvs.find(i => i.id === inventoryId) || {};

  const itemCountFor = (invId) => calculateDescendantItemCount(invId, allInvs, allItems);

  const renderBreadcrumbs = () => {
    const crumbs = [];
    const seen = new Set();
    let curr = allInvs.find(i => i.id === inventoryId);
    // Depth-capped so a cycle in parentInventoryId can't hang the render.
    while (curr && !seen.has(curr.id) && crumbs.length < 20) {
      crumbs.unshift(curr);
      seen.add(curr.id);
      if (!curr.parentInventoryId) break;
      curr = allInvs.find(i => i.id === curr.parentInventoryId);
    }
    const currentList = lists.find(l => l.id === currentInventory.listId);

    return (
      <View style={styles.breadcrumbBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
          {currentList && (
            <Pressable onPress={() => navigation.navigate('InventoryDetail', { listId: currentList.id, listName: currentList.name })}>
              <Text style={styles.crumbLink}>{currentList.name}</Text>
            </Pressable>
          )}
          {crumbs.map((c) => (
            <React.Fragment key={c.id}>
              <Text style={styles.crumbSep}>/</Text>
              <Pressable onPress={() => {
                if (c.id !== inventoryId) {
                  navigation.navigate('FolderDetail', { inventoryId: c.id, inventoryName: c.name });
                }
              }}>
                <Text style={[styles.crumbText, c.id === inventoryId && styles.crumbActive]}>
                  {c.name}
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    );
  };

  const holderNameFor = (email) => getHolderName(email, usersList);

  const renderOverview = () => {
    const status = resolveStatus(currentInventory);
    const badgeVariant = getStatusBadgeVariant(status);

    return (
      <ScrollView contentContainerStyle={{ padding: appSpacing.xl, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.overviewHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overviewTitle}>{currentInventory.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={styles.overviewSub}>Status: </Text>
              <AppBadge variant={badgeVariant}>{status}</AppBadge>
            </View>
          </View>
          <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<MoreVertical size={16} color={appColors.textPrimary} />} 
            onPress={() => setIsActionsModalVisible(true)}
          >
            Actions
          </AppButton>
        </View>
        
        <AppSection title="Assignment & Custody" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="elevated" style={{ padding: appSpacing.lg }}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Holder</Text>
              <Text style={styles.infoValue}>{holderNameFor(currentInventory.currentHolder)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Room / Location</Text>
              <Text style={styles.infoValue}>{currentInventory.currentRoom || 'Not specified'}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.infoLabel}>Assigned Date</Text>
              <Text style={styles.infoValue}>
                {currentInventory.currentAssignedDate ? new Date(currentInventory.currentAssignedDate).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </AppCard>
        </AppSection>

        {currentInventory.previousHolder && (
          <AppSection title="Previous Custody" style={{ marginTop: appSpacing.lg }}>
            <AppCard variant="surface" style={{ padding: appSpacing.lg }}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Previous Holder</Text>
                <Text style={styles.infoValueMuted}>{holderNameFor(currentInventory.previousHolder)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Previous Room</Text>
                <Text style={styles.infoValueMuted}>{currentInventory.previousRoom || 'Unknown'}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.infoLabel}>Released Date</Text>
                <Text style={styles.infoValueMuted}>
                  {currentInventory.previousAssignedDate ? new Date(currentInventory.previousAssignedDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </AppCard>
          </AppSection>
        )}

        <AppSection title="Folder Statistics" style={{ marginTop: appSpacing.lg }}>
          <AppCard variant="surface" style={{ padding: appSpacing.lg }}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Items (Descendants)</Text>
              <Text style={styles.infoValue}>{itemCountFor(inventoryId)}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.infoLabel}>Created By</Text>
              <Text style={styles.infoValue}>{currentInventory.createdBy || 'System'}</Text>
            </View>
          </AppCard>
        </AppSection>
      </ScrollView>
    );
  };

  const handleTabChange = (val) => {
    setActiveTab(val);
    setIsSelectionMode(false);
    setSelectedSet(new Set());
  };

  const filteredSubInvs = subInventories.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredItems = items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const visibleRows = activeTab === 'sub' ? filteredSubInvs : filteredItems;

  const toggleSelection = (id) => setSelectedSet(prev => toggleInSet(prev, id));

  const handleSelectAll = () => setSelectedSet(prev => toggleSelectAll(prev, visibleRows));

  const renderSubInventories = () => (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={filteredSubInvs}
      keyExtractor={(item) => item.id}
      extraData={selectedSet}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const count = itemCountFor(item.id);
        const status = resolveStatus(item);
        const badgeVariant = getStatusBadgeVariant(status);
        const holder = holderNameFor(item.currentHolder);
        const isSelected = selectedSet.has(item.id);

        const leftIcon = isSelectionMode ? (
          <Pressable onPress={() => toggleSelection(item.id)} style={{ marginRight: 8 }}>
            {isSelected ? (
              <CheckSquare size={20} color={appColors.accent} />
            ) : (
              <Square size={20} color={appColors.textSecondary} />
            )}
          </Pressable>
        ) : (
          <View style={styles.folderIconBox}>
            <Folder size={18} color="#38BDF8" />
          </View>
        );

        return (
          <AppListItem
            title={item.name || 'Unnamed Folder'}
            description={`${count} ${count === 1 ? 'item' : 'items'} • Held by ${holder} • ${getRelativeTime(item.updatedAt || item.createdAt)}`}
            leftIcon={leftIcon}
            rightElement={<AppBadge variant={badgeVariant}>{status}</AppBadge>}
            onPress={() => {
              if (isSelectionMode) toggleSelection(item.id);
              else navigation.push('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
            }}
            style={isSelected && { backgroundColor: `${appColors.accent}10`, borderColor: `${appColors.accent}30` }}
          />
        );
      }}
      ListEmptyComponent={
        <AppEmptyState
          title="No sub-folders"
          description="There are no sub-compartments in this folder yet."
          actionLabel="Create Sub-Folder"
          onAction={() => setIsAddModalVisible(true)}
        />
      }
    />
  );

  const renderItems = () => (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={filteredItems}
      keyExtractor={(item) => item.id}
      extraData={selectedSet}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isSelected = selectedSet.has(item.id);

        const leftIcon = isSelectionMode ? (
          <Pressable onPress={() => toggleSelection(item.id)} style={{ marginRight: 8 }}>
            {isSelected ? (
              <CheckSquare size={20} color={appColors.accent} />
            ) : (
              <Square size={20} color={appColors.textSecondary} />
            )}
          </Pressable>
        ) : (
          <View style={styles.itemIconBox}>
            <Box size={18} color="#A855F7" />
          </View>
        );

        return (
          <AppListItem
            title={item.name || 'Unnamed Item'}
            description={`Category: ${item.category || 'General'} • Added ${getRelativeTime(item.createdAt)}`}
            leftIcon={leftIcon}
            rightElement={
              <View style={styles.qtyBox}>
                <Text style={styles.qtyText}>Qty: {item.quantity || 0}</Text>
              </View>
            }
            onPress={() => {
              if (isSelectionMode) toggleSelection(item.id);
              else navigation.navigate('ItemDetail', { itemId: item.id, itemData: item });
            }}
            onDelete={!isSelectionMode ? () => {
              Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => InventoryService.deleteItem(item.id) }
              ]);
            } : undefined}
            style={isSelected && { backgroundColor: `${appColors.accent}10`, borderColor: `${appColors.accent}30` }}
          />
        );
      }}
      ListEmptyComponent={
        <AppEmptyState
          title="No equipment items"
          description="There are no physical items logged directly inside this folder."
          actionLabel="Add Equipment Item"
          onAction={() => setIsAddModalVisible(true)}
        />
      }
    />
  );

  const renderHistory = () => (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: appSpacing.xl, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        let accentColor = appColors.primary;
        const action = item.action || '';
        if (action.includes('Holder Assigned')) accentColor = '#10B981';
        else if (action.includes('Holder Removed')) accentColor = '#EF4444';
        else if (action.includes('Item Added')) accentColor = '#3B82F6';
        else if (action.includes('Quantity Edited')) accentColor = '#F59E0B';
        else if (action.includes('Item Renamed')) accentColor = '#A855F7';
        else if (action.includes('Item Moved')) accentColor = '#F97316';
        else if (action.includes('Item Deleted') || action.includes('Deleted')) accentColor = '#EF4444';

        return (
          <AppCard variant="surface" style={[styles.historyCard, { borderLeftColor: accentColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.historyTitle}>{item.action}</Text>
              <Text style={styles.historyUser}>{item.userId || 'System'}</Text>
            </View>
            <Text style={styles.historyTime}>
              {item.timestamp?.toLocaleString() || new Date(item.createdAt).toLocaleString()}
            </Text>
            <Text style={styles.historyDetails}>{item.details}</Text>
            {action.includes('Quantity Edited') && item.previousQuantity !== undefined && item.newQuantity !== undefined && (
              <Text style={styles.historyQtyChange}>
                Quantity changed: {item.previousQuantity} → {item.newQuantity}
              </Text>
            )}
          </AppCard>
        );
      }}
      ListEmptyComponent={
        <AppEmptyState
          title="No audit history"
          description="No activities or custody changes have been recorded for this folder yet."
        />
      }
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          <AppChip selected={activeTab === 'overview'} onPress={() => handleTabChange('overview')} style={{ marginRight: 8 }}>
            Overview
          </AppChip>
          <AppChip selected={activeTab === 'sub'} onPress={() => handleTabChange('sub')} style={{ marginRight: 8 }}>
            Sub-Folders ({subInventories.length})
          </AppChip>
          <AppChip selected={activeTab === 'items'} onPress={() => handleTabChange('items')} style={{ marginRight: 8 }}>
            Items ({items.length})
          </AppChip>
          <AppChip selected={activeTab === 'history'} onPress={() => handleTabChange('history')}>
            Audit Log
          </AppChip>
        </ScrollView>
      </View>

      {renderBreadcrumbs()}

      {(activeTab === 'sub' || activeTab === 'items') && (
        <>
          <View style={styles.topActionsRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppButton 
                variant="secondary" 
                size="sm" 
                onPress={() => setIsExportVisible(true)}
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
                {isSelectionMode ? (selectedSet.size === (activeTab === 'sub' ? filteredSubInvs.length : filteredItems.length) && (activeTab === 'sub' ? filteredSubInvs.length : filteredItems.length) > 0 ? 'Deselect All' : 'Select All') : 'Select'}
              </AppButton>
            </View>
            {isSelectionMode && (
              <Pressable onPress={() => { setIsSelectionMode(false); setSelectedSet(new Set()); }} hitSlop={10}>
                <X size={20} color={appColors.textSecondary} />
              </Pressable>
            )}
          </View>
          <AppSearchBar
            placeholder={`Search ${activeTab === 'sub' ? 'sub-folders' : 'items'}...`}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
        </>
      )}
      
      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sub' && renderSubInventories()}
          {activeTab === 'items' && renderItems()}
          {activeTab === 'history' && renderHistory()}
        </View>
      )}

      {!isSelectionMode && (activeTab === 'sub' || activeTab === 'items') && (
        <AppFAB
          label={activeTab === 'sub' ? "New Folder" : "New Item"}
          onPress={() => setIsAddModalVisible(true)}
        />
      )}

      {isSelectionMode && selectedSet.size > 0 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkText}>{selectedSet.size} selected</Text>
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

      <ExportModal 
        visible={isExportVisible}
        onDismiss={() => setIsExportVisible(false)}
        inventoryId={inventoryId}
        listId={currentInventory?.listId}
      />

      <MoveDestinationModal
        visible={isMoveModalVisible}
        onDismiss={() => setIsMoveModalVisible(false)}
        lists={lists}
        inventories={allInvs}
        allowedTypes={activeTab === 'items' ? ['inventory'] : ['list', 'inventory']}
        invalidTargets={
          activeTab === 'sub' 
            ? Array.from(selectedSet).map(id => `inventory:${id}`)
            : []
        }
        onConfirm={async (dest) => {
          setIsMoveModalVisible(false);
          try {
            if (activeTab === 'items') {
              await Promise.all(
                Array.from(selectedSet).map(itemId => 
                  InventoryService.updateItem(itemId, { inventoryId: dest.id })
                )
              );
            } else {
              await Promise.all(
                Array.from(selectedSet).map(invId =>
                  InventoryService.moveInventory(invId, dest, allInvs)
                )
              );
            }
            setIsSelectionMode(false);
            setSelectedSet(new Set());
          } catch (e) {
            Alert.alert('Move Failed', 'Could not move the selected items. Please try again.');
          }
        }}
      />

      {/* New Sub-Folder / Item Modal */}
      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title={`Create ${activeTab === 'sub' ? 'Sub-Folder' : 'Equipment Item'}`}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setIsAddModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>
              Cancel
            </AppButton>
            <AppButton 
              variant="primary" 
              onPress={async () => {
                if (!newName.trim()) return;
                try {
                  if (activeTab === 'sub') {
                    await InventoryService.addSubInventory(currentInventory.listId, inventoryId, newName.trim());
                  } else {
                    await InventoryService.addItem(inventoryId, { name: newName.trim(), quantity: parseInt(newQty || 1, 10), category: newCategory.trim() });
                  }
                  setIsAddModalVisible(false);
                  setNewName('');
                  setNewQty('1');
                  setNewCategory('');
                } catch (e) {
                  Alert.alert('Error', 'Could not create the resource. Please try again.');
                }
              }} 
              disabled={!newName.trim()}
              style={{ flex: 1 }}
            >
              Create
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Name"
          value={newName}
          onChangeText={setNewName}
          placeholder={`e.g. ${activeTab === 'sub' ? 'Screws & Standoffs' : 'T-Motor Velox V2'}`}
          autoFocus
        />
        {activeTab === 'items' && (
          <View style={{ marginTop: 16 }}>
            <AppInput
              label="Quantity"
              value={newQty}
              onChangeText={setNewQty}
              keyboardType="numeric"
              placeholder="1"
            />
            <View style={{ marginTop: 16 }}>
              <AppInput
                label="Category / Tag"
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="e.g. Motors, ESC, Frame"
              />
            </View>
          </View>
        )}
      </AppModal>

      {/* Assign Holder Modal */}
      <AppModal
        visible={isAssignModalVisible}
        onClose={() => setIsAssignModalVisible(false)}
        title="Assign Folder Custody"
        scrollable={false}
      >
        <Text style={styles.modalHelper}>
          Select a team member to take custody and accountability for this folder and its contents.
        </Text>
        <AppSearchBar
          placeholder="Search team members..."
          onChangeText={setAssignSearchQuery}
          value={assignSearchQuery}
          style={{ marginBottom: 12 }}
        />
        <View style={{ maxHeight: 300 }}>
          <FlatList
            data={usersList.filter(u => 
              u.isArchived !== true && 
              u.isActive !== false &&
              (u.name?.toLowerCase().includes(assignSearchQuery.toLowerCase()) || u.email?.toLowerCase().includes(assignSearchQuery.toLowerCase()))
            )}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AppListItem
                title={item.name || item.email}
                description={item.roomNumber ? `Room / Location: ${item.roomNumber}` : 'No room specified'}
                leftIcon={<View style={styles.userIconBox}><User size={18} color="#10B981" /></View>}
                onPress={async () => {
                  try {
                    await InventoryService.assignHolder(
                      inventoryId, 
                      item.email, 
                      item.roomNumber || 'Unknown',
                      currentInventory.currentHolder,
                      currentInventory.currentRoom,
                      currentInventory.currentAssignedDate,
                      user?.email
                    );
                    setIsAssignModalVisible(false);
                    setAssignSearchQuery('');
                  } catch (e) {
                    Alert.alert('Assignment Failed', 'Could not assign custody. Please try again.');
                  }
                }}
              />
            )}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: appColors.textMuted, padding: 20 }}>No matching users found.</Text>}
          />
        </View>
      </AppModal>

      {/* Overview Actions Modal */}
      <AppModal
        visible={isActionsModalVisible}
        onClose={() => setIsActionsModalVisible(false)}
        title="Folder Actions"
      >
        <View style={{ gap: 10 }}>
          <AppButton 
            variant="secondary" 
            icon={<UserCheck size={18} color={appColors.textPrimary} />} 
            onPress={() => { setIsActionsModalVisible(false); setIsAssignModalVisible(true); }}
            style={{ justifyContent: 'flex-start' }}
          >
            Assign Team Holder
          </AppButton>
          <AppButton 
            variant="secondary" 
            icon={<CheckCircle2 size={18} color="#10B981" />} 
            onPress={() => { setIsActionsModalVisible(false); InventoryService.updateInventoryStatus(inventoryId, 'Available'); }}
            style={{ justifyContent: 'flex-start' }}
          >
            Mark as Available
          </AppButton>
          <AppButton 
            variant="secondary" 
            icon={<AlertTriangle size={18} color="#F59E0B" />} 
            onPress={() => { setIsActionsModalVisible(false); InventoryService.updateInventoryStatus(inventoryId, 'Missing'); }}
            style={{ justifyContent: 'flex-start' }}
          >
            Mark as Missing
          </AppButton>
          <View style={{ height: 1, backgroundColor: appColors.border, marginVertical: 6 }} />
          <AppButton 
            variant="danger" 
            icon={<Trash2 size={18} color="#EF4444" />} 
            onPress={() => {
              setIsActionsModalVisible(false);
              if (subInventories.length > 0 || items.length > 0) {
                Alert.alert('Error', 'Cannot delete a folder that still contains equipment items or sub-folders.');
              } else {
                InventoryService.deleteInventory(inventoryId);
                navigation.goBack();
              }
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Delete Folder
          </AppButton>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    paddingTop: 12,
    paddingBottom: 10,
  },
  tabScroll: {
    paddingHorizontal: appSpacing.xl,
  },
  breadcrumbBar: {
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    paddingVertical: 10,
  },
  breadcrumbScroll: {
    paddingHorizontal: appSpacing.xl,
    alignItems: 'center',
    flexDirection: 'row',
  },
  crumbLink: {
    ...appTypography.captionBold,
    color: appColors.accent,
    fontSize: 13,
  },
  crumbSep: {
    color: appColors.textMuted,
    marginHorizontal: 6,
    fontSize: 12,
  },
  crumbText: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    fontSize: 13,
  },
  crumbActive: {
    color: appColors.textPrimary,
    fontWeight: '700',
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  overviewTitle: {
    ...appTypography.sectionTitle,
    fontSize: 24,
    color: appColors.textPrimary,
  },
  overviewSub: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    marginRight: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  infoLabel: {
    ...appTypography.body,
    color: appColors.textSecondary,
  },
  infoValue: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  infoValueMuted: {
    ...appTypography.body,
    color: appColors.textMuted,
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
  },
  searchBar: {
    marginHorizontal: appSpacing.xl,
    marginVertical: 12,
  },
  folderIconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `${appColors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `#A855F715`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconBox: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    backgroundColor: `#10B98115`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: appRadius.pill,
  },
  qtyText: {
    ...appTypography.captionBold,
    color: appColors.textPrimary,
  },
  historyCard: {
    padding: appSpacing.lg,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  historyTitle: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  historyUser: {
    ...appTypography.captionBold,
    color: appColors.textMuted,
  },
  historyTime: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  historyDetails: {
    ...appTypography.body,
    color: appColors.textPrimary,
  },
  historyQtyChange: {
    ...appTypography.captionBold,
    color: appColors.accent,
    marginTop: 6,
    fontStyle: 'italic',
  },
  loadingWrap: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
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

