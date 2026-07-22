import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Searchbar, FAB, List, useTheme, Text, ActivityIndicator, SegmentedButtons, Checkbox, Badge, Portal, Dialog, TextInput, Button, IconButton, Menu } from 'react-native-paper';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';

const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const diff = Math.floor((new Date() - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export default function FolderDetailScreen({ route, navigation }) {
  const theme = useTheme();
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

  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCategory, setNewCategory] = useState('');

  const [isAssignDialogVisible, setIsAssignDialogVisible] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportVisible, setIsExportVisible] = useState(false);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  useEffect(() => {
    navigation.setOptions({ title: inventoryName || 'Folder' });
    const unsubscribeItems = InventoryService.subscribeToItems(inventoryId, (data) => setItems(data));
    const unsubscribeSubInvs = InventoryService.subscribeToSubInventories(inventoryId, (data) => setSubInventories(data));
    const unsubscribeAllInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    const unsubscribeLists = InventoryService.subscribeToLists((data) => setLists(data));
    const unsubscribeAllItems = InventoryService.subscribeToAllItems?.((data) => setAllItems(data)) || (() => {});
    
    const unsubscribeHistory = InventoryService.subscribeToHistory(inventoryId, (data) => setHistory(data));
    const unsubscribeUsers = UsersService.subscribeToUsers((data) => setUsersList(data));

    // For backward compatibility if subscribeToAllItems is missing
    if (!InventoryService.subscribeToAllItems) {
      InventoryService.getAllItems().then(data => setAllItems(data));
    }

    setTimeout(() => setLoading(false), 800);

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

  const calculateDescendantItemCount = (invId) => {
    let ids = [invId];
    const getChildren = (parentId) => {
      const children = allInvs.filter(i => i.parentInventoryId === parentId);
      for (const child of children) {
        ids.push(child.id);
        getChildren(child.id);
      }
    };
    getChildren(invId);
    
    let total = 0;
    allItems.forEach(item => {
      if (ids.includes(item.inventoryId)) {
        total += parseInt(item.quantity || 1, 10);
      }
    });
    return total;
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'Available': return { bg: theme.colors.primaryContainer, text: theme.colors.onPrimaryContainer };
      case 'Missing': return { bg: '#FFF3E0', text: '#E65100' };
      default: return { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer }; // CheckedOut
    }
  };

  const renderBreadcrumbs = () => {
    const crumbs = [];
    let curr = allInvs.find(i => i.id === inventoryId);
    while (curr) {
        crumbs.unshift(curr);
        if (curr.parentInventoryId) {
            curr = allInvs.find(i => i.id === curr.parentInventoryId);
        } else {
            break;
        }
    }
    const currentList = lists.find(l => l.id === currentInventory.listId);

    return (
        <View style={{ flexGrow: 0 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' }}>
                {currentList && (
                    <TouchableOpacity onPress={() => navigation.navigate('ListDetail', { listId: currentList.id, listName: currentList.name }) || navigation.goBack()}>
                        <Text style={{ color: theme.colors.primary, fontSize: 13 }}>{currentList.name}</Text>
                    </TouchableOpacity>
                )}
                {crumbs.map((c) => (
                    <React.Fragment key={c.id}>
                        <Text style={{ color: theme.colors.onSurfaceVariant, marginHorizontal: 4 }}>/</Text>
                        <TouchableOpacity onPress={() => {
                            if (c.id !== inventoryId) {
                                navigation.navigate('FolderDetail', { inventoryId: c.id, inventoryName: c.name });
                            }
                        }}>
                            <Text style={{ color: c.id === inventoryId ? theme.colors.onSurface : theme.colors.primary, fontSize: 13, fontWeight: c.id === inventoryId ? 'bold' : 'normal' }}>
                                {c.name}
                            </Text>
                        </TouchableOpacity>
                    </React.Fragment>
                ))}
            </ScrollView>
        </View>
    );
  };

  const renderOverview = () => {
    const getHolderName = (email) => {
      if (!email) return 'None';
      const userObj = usersList.find(u => u.email === email);
      return userObj?.name || email;
    };

    const status = currentInventory.status || (currentInventory.currentHolder ? 'CheckedOut' : 'Available');
    const statusColors = getStatusColors(status);

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text variant="titleLarge" style={{ fontWeight: 'bold', flex: 1 }}>{currentInventory.name}</Text>
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={<IconButton icon="dots-vertical" onPress={openMenu} />}
          >
            <Menu.Item onPress={() => { closeMenu(); handleTabChange('overview'); setIsAssignDialogVisible(true); }} title="Assign Holder" />
            <Menu.Item onPress={() => { closeMenu(); InventoryService.updateInventoryStatus(inventoryId, 'Available'); }} title="Mark Available" />
            <Menu.Item onPress={() => { closeMenu(); InventoryService.updateInventoryStatus(inventoryId, 'Missing'); }} title="Mark Missing" />
            <Menu.Item onPress={() => {
              closeMenu();
              if (subInventories.length > 0 || items.length > 0) {
                Alert.alert('Error', 'Cannot delete inventory that has items or sub-folders.');
              } else {
                InventoryService.deleteInventory(inventoryId);
                navigation.goBack();
              }
            }} title="Delete Inventory" />
          </Menu>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 140 }}>Status:</Text>
          <View style={[styles.badge, { backgroundColor: statusColors.bg, alignSelf: 'flex-start' }]}>
            <Text style={{ fontSize: 12, color: statusColors.text, fontWeight: 'bold' }}>{status}</Text>
          </View>
        </View>
        
        <View style={{ marginVertical: 16, height: 1, backgroundColor: '#eee' }} />

        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>Current Holder</Text>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>User</Text>
          <Text style={{ fontWeight: 'bold' }}>{getHolderName(currentInventory.currentHolder)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>Room</Text>
          <Text style={{ fontWeight: 'bold' }}>{currentInventory.currentRoom || 'Unknown'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>Since</Text>
          <Text style={{ fontWeight: 'bold' }}>{currentInventory.currentAssignedDate ? new Date(currentInventory.currentAssignedDate).toLocaleDateString() : 'N/A'}</Text>
        </View>
        
        <View style={{ marginVertical: 16, height: 1, backgroundColor: '#eee' }} />
        
        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.onSurfaceVariant }}>Previous Holder</Text>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>User</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{getHolderName(currentInventory.previousHolder)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>Room</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{currentInventory.previousRoom || 'Unknown'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ width: 140, color: theme.colors.onSurfaceVariant }}>Since</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{currentInventory.previousAssignedDate ? new Date(currentInventory.previousAssignedDate).toLocaleDateString() : 'N/A'}</Text>
        </View>

        <View style={{ marginVertical: 16, height: 1, backgroundColor: '#eee' }} />

        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 140 }}>Total Items:</Text>
          <Text>{calculateDescendantItemCount(inventoryId)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 140 }}>Created By:</Text>
          <Text>{currentInventory.createdBy || 'N/A'}</Text>
        </View>
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

  const toggleSelection = (id) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSet(next);
  };

  const handleSelectAll = () => {
    const filtered = activeTab === 'sub' ? filteredSubInvs : filteredItems;
    if (selectedSet.size === filtered.length) {
      setSelectedSet(new Set());
    } else {
      setSelectedSet(new Set(filtered.map(i => i.id)));
    }
  };

  const renderSubInventories = () => {
    return (
      <FlatList
        data={filteredSubInvs}
        keyExtractor={(item) => item.id}
        extraData={selectedSet}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        renderItem={({ item }) => {
          const count = calculateDescendantItemCount(item.id);
          const status = item.status || (item.currentHolder ? 'CheckedOut' : 'Available');
          const statusColors = getStatusColors(status);
          const holder = item.currentHolder || 'None';

          const isSelected = selectedSet.has(item.id);

          return (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (isSelectionMode) toggleSelection(item.id);
                else navigation.push('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
              }}
              style={[
                styles.card, 
                { backgroundColor: theme.colors.surface },
                isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
              ]}
            >
              <View style={styles.cardHeader}>
                {isSelectionMode && (
                  <View style={{ marginRight: 8 }}>
                    <Checkbox status={isSelected ? 'checked' : 'unchecked'} onPress={() => toggleSelection(item.id)} />
                  </View>
                )}
                <Text variant="titleMedium" style={{ flex: 1, fontWeight: 'bold' }}>{item.name || 'Unnamed Folder'}</Text>
                <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
                  <Text style={{ fontSize: 10, color: statusColors.text }}>{status}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="account" size={14} color={theme.colors.onSurfaceVariant} />
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginLeft: 4 }}>{holder}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="package-variant-closed" size={14} color={theme.colors.onSurfaceVariant} />
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginLeft: 4 }}>{count}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.onSurfaceVariant} />
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginLeft: 4 }}>
                    {getRelativeTime(item.updatedAt || item.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No sub-inventories found.</Text>}
      />
    );
  };

  const renderItems = () => {
    return (
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        extraData={selectedSet}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        renderItem={({ item }) => {
          const isSelected = selectedSet.has(item.id);
          return (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (isSelectionMode) toggleSelection(item.id);
                else navigation.navigate('ItemDetail', { itemId: item.id, itemData: item });
              }}
              style={[
                { backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8, elevation: 1, flexDirection: 'row', alignItems: 'center', padding: 12 },
                isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
              ]}
            >
              {isSelectionMode && (
                <View style={{ marginRight: 8 }}>
                  <Checkbox status={isSelected ? 'checked' : 'unchecked'} onPress={() => toggleSelection(item.id)} />
                </View>
              )}
              <MaterialCommunityIcons name="tools" size={24} color={theme.colors.secondary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 16 }}>{item.name || 'Unnamed Item'}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Qty: {item.quantity || 0}</Text>
              </View>
              {!isSelectionMode && (
                <IconButton
                  icon="trash-can-outline"
                  iconColor={theme.colors.error}
                  size={20}
                  onPress={() => {
                    Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => InventoryService.deleteItem(item.id) }
                    ]);
                  }}
                />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No items found.</Text>}
      />
    );
  };

  const renderHistory = () => {
    return (
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16, paddingTop: 16 }}
        renderItem={({ item }) => {
          let borderColor = theme.colors.primary;
          const action = item.action || '';
          if (action.includes('Holder Assigned')) borderColor = '#22c55e';
          else if (action.includes('Holder Removed')) borderColor = '#ef4444';
          else if (action.includes('Item Added')) borderColor = '#3b82f6';
          else if (action.includes('Quantity Edited')) borderColor = '#f59e0b';
          else if (action.includes('Item Renamed')) borderColor = '#a855f7';
          else if (action.includes('Item Moved')) borderColor = '#f97316';
          else if (action.includes('Item Deleted') || action.includes('Deleted')) borderColor = '#ef4444';

          return (
            <View style={{ marginBottom: 16, borderLeftWidth: 4, borderLeftColor: borderColor, paddingLeft: 12, backgroundColor: theme.colors.surface, padding: 12, borderRadius: 4, elevation: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 'bold' }}>{item.action}</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>{item.userId || 'System'}</Text>
              </View>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginVertical: 4 }}>
                {item.timestamp?.toLocaleString() || new Date(item.createdAt).toLocaleString()}
              </Text>
              <Text style={{ marginTop: 2 }}>{item.details}</Text>
              {action.includes('Quantity Edited') && item.oldQuantity !== undefined && item.newQuantity !== undefined && (
                 <Text style={{ color: theme.colors.secondary, marginTop: 4, fontStyle: 'italic' }}>
                   Qty changed: {item.oldQuantity} → {item.newQuantity}
                 </Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No history logs found.</Text>}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={handleTabChange}
          buttons={[
            { value: 'overview', label: 'Overview' },
            { value: 'sub', label: 'Sub Inv' },
            { value: 'items', label: 'Items' },
            { value: 'history', label: 'History' },
          ]}
          style={{ transform: [{ scale: 0.9 }] }}
        />
      </View>

      {renderBreadcrumbs()}

      {(activeTab === 'sub' || activeTab === 'items') && (
        <View style={styles.headerActions}>
          <Button 
            icon="download" 
            mode="text" 
            onPress={() => setIsExportVisible(true)}
          >
            Export
          </Button>
          <Button 
            icon={isSelectionMode ? "check-all" : "check"} 
            mode={isSelectionMode ? "contained-tonal" : "text"}
            onPress={() => {
              if (!isSelectionMode) setIsSelectionMode(true);
              else handleSelectAll();
            }}
          >
            {isSelectionMode ? (selectedSet.size === (activeTab === 'sub' ? filteredSubInvs.length : filteredItems.length) && (activeTab === 'sub' ? filteredSubInvs.length : filteredItems.length) > 0 ? 'Deselect All' : 'Select All') : 'Select'}
          </Button>
          {isSelectionMode && (
            <IconButton icon="close" size={20} onPress={() => { setIsSelectionMode(false); setSelectedSet(new Set()); }} />
          )}
        </View>
      )}

      {(activeTab === 'sub' || activeTab === 'items') && (
        <Searchbar
          placeholder={`Search ${activeTab === 'sub' ? 'Sub-Inventories' : 'Items'}...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      )}
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sub' && renderSubInventories()}
          {activeTab === 'items' && renderItems()}
          {activeTab === 'history' && renderHistory()}
        </View>
      )}

      {!isSelectionMode && (activeTab === 'sub' || activeTab === 'items') && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => setIsAddDialogVisible(true)}
        />
      )}

      {isSelectionMode && selectedSet.size > 0 && (
        <View style={[styles.bulkAction, { backgroundColor: theme.colors.elevation.level3 }]}>
          <Text>{selectedSet.size} selected</Text>
          <Button mode="contained" onPress={() => setIsMoveModalVisible(true)}>Move</Button>
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
                  InventoryService.moveInventory(
                    invId, 
                    dest.type === 'list' ? dest.id : (allInvs.find(i => i.id === dest.id)?.listId), 
                    dest.type === 'inventory' ? dest.id : null
                  )
                )
              );
            }
            setIsSelectionMode(false);
            setSelectedSet(new Set());
          } catch (e) {
            alert('Failed to move');
          }
        }}
      />

      <Portal>
        <Dialog visible={isAddDialogVisible} onDismiss={() => setIsAddDialogVisible(false)}>
          <Dialog.Title>New {activeTab === 'sub' ? 'Folder' : 'Item'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              autoFocus
            />
            {activeTab === 'items' && (
              <>
                <TextInput
                  label="Quantity"
                  value={newQty}
                  onChangeText={setNewQty}
                  mode="outlined"
                  keyboardType="numeric"
                  style={{ marginTop: 12 }}
                />
                <TextInput
                  label="Category"
                  value={newCategory}
                  onChangeText={setNewCategory}
                  mode="outlined"
                  style={{ marginTop: 12 }}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAddDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={async () => {
                if (!newName.trim()) return;
                try {
                  if (activeTab === 'sub') {
                    await InventoryService.addSubInventory(currentInventory.listId, inventoryId, newName.trim());
                  } else {
                    await InventoryService.addItem(inventoryId, { name: newName.trim(), quantity: parseInt(newQty || 1, 10), category: newCategory.trim() });
                  }
                  setIsAddDialogVisible(false);
                  setNewName('');
                  setNewQty('1');
                  setNewCategory('');
                } catch (e) {
                  alert('Error creating');
                }
              }} 
              disabled={!newName.trim()}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isAssignDialogVisible} onDismiss={() => setIsAssignDialogVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>Assign Holder</Dialog.Title>
          <Dialog.Content>
            <Searchbar
              placeholder="Search users..."
              onChangeText={setAssignSearchQuery}
              value={assignSearchQuery}
              style={{ marginBottom: 12, elevation: 0, borderWidth: 1, borderColor: '#ddd' }}
            />
            <FlatList
              data={usersList.filter(u => 
                u.isArchived !== true && 
                u.isActive !== false &&
                (u.name?.toLowerCase().includes(assignSearchQuery.toLowerCase()) || u.email?.toLowerCase().includes(assignSearchQuery.toLowerCase()))
              )}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <List.Item
                  title={item.name || item.email}
                  description={item.roomNumber ? `Room: ${item.roomNumber}` : 'No room specified'}
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
                      setIsAssignDialogVisible(false);
                      setAssignSearchQuery('');
                    } catch (e) {
                      alert('Failed to assign holder');
                    }
                  }}
                />
              )}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAssignDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  card: { marginHorizontal: 16, marginVertical: 6, borderRadius: 12, padding: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  cardMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 16, borderRadius: 16 },
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  bulkAction: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4 }
});
