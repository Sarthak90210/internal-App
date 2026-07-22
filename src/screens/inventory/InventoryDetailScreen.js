import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Searchbar, List, useTheme, Text, ActivityIndicator, Button, Checkbox, IconButton, Portal, Dialog, TextInput, FAB } from 'react-native-paper';
import { InventoryService } from '../../services/inventory';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../stores/authStore';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';

const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const seconds = timestamp.seconds || (new Date(timestamp).getTime() / 1000);
  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
};

export default function InventoryDetailScreen({ route, navigation }) {
  const theme = useTheme();
  const { listId, listName } = route.params;
  const [inventories, setInventories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInventories, setSelectedInventories] = useState(new Set());

  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [newInventoryName, setNewInventoryName] = useState('');
  
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: listName || 'Inventories' });
    const unsubscribeList = InventoryService.subscribeToInventories(listId, (data) => {
      setInventories(data);
      setLoading(false);
    });
    
    // Subscribe to all inventories and items to calculate descendants effectively
    const unsubscribeAllInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    const unsubscribeLists = InventoryService.subscribeToLists((data) => setLists(data));
    const unsubscribeAllItems = InventoryService.subscribeToAllItems((data) => setAllItems(data));

    return () => {
      unsubscribeList();
      unsubscribeAllInvs();
      unsubscribeLists();
      unsubscribeAllItems();
    };
  }, [listId, listName, navigation]);

  const filtered = inventories.filter(i => 
    !i.parentInventoryId && 
    (i.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleSelection = (id) => {
    const next = new Set(selectedInventories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInventories(next);
  };

  const handleSelectAll = () => {
    if (selectedInventories.size === filtered.length) {
      setSelectedInventories(new Set());
    } else {
      setSelectedInventories(new Set(filtered.map(i => i.id)));
    }
  };

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

  const handleAddInventory = async () => {
    if (!newInventoryName.trim()) return;
    try {
      await InventoryService.addInventory(listId, newInventoryName.trim());
      setIsAddDialogVisible(false);
      setNewInventoryName('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create inventory');
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'Available') return { bg: theme.colors.primaryContainer, color: theme.colors.onPrimaryContainer };
    if (status === 'Missing') return { bg: '#FFF3E0', color: '#E65100' };
    return { bg: theme.colors.errorContainer, color: theme.colors.onErrorContainer };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <View style={styles.headerActions}>
        <Button 
          icon="download" 
          mode="text" 
          onPress={() => setIsExportModalVisible(true)}
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
          {isSelectionMode ? (selectedInventories.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All') : 'Select'}
        </Button>
        {isSelectionMode && (
          <IconButton icon="close" size={20} onPress={() => { setIsSelectionMode(false); setSelectedInventories(new Set()); }} />
        )}
      </View>

      <Searchbar
        placeholder="Search Inventories..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
      />
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => {
            const count = calculateDescendantItemCount(item.id);
            const status = item.status || (item.currentHolder ? 'CheckedOut' : 'Available');
            const holder = item.currentHolder || 'None';
            const isSelected = selectedInventories.has(item.id);
            const statusStyle = getStatusStyle(status);

            return (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => {
                  if (isSelectionMode) {
                    toggleSelection(item.id);
                  } else {
                    navigation.navigate('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
                  }
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
                  <Text variant="titleMedium" style={{ flex: 1, fontWeight: 'bold' }}>{item.name || 'Unnamed Inventory'}</Text>
                  <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={{ fontSize: 10, color: statusStyle.color }}>{status}</Text>
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
                      {getRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No inventories found.
            </Text>
          }
        />
      )}

      {isSelectionMode && selectedInventories.size > 0 && (
        <View style={[styles.bulkAction, { backgroundColor: theme.colors.elevation.level3 }]}>
          <Text>{selectedInventories.size} selected</Text>
          <Button mode="contained" onPress={() => setIsMoveModalVisible(true)}>Move</Button>
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
            alert('Failed to move');
          }
        }}
      />

      <ExportModal 
        visible={isExportModalVisible} 
        onDismiss={() => setIsExportModalVisible(false)} 
        listId={listId} 
      />

      {!isSelectionMode && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => setIsAddDialogVisible(true)}
        />
      )}

      <Portal>
        <Dialog visible={isAddDialogVisible} onDismiss={() => setIsAddDialogVisible(false)}>
          <Dialog.Title>New Inventory</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Inventory Name"
              value={newInventoryName}
              onChangeText={setNewInventoryName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAddDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddInventory} disabled={!newInventoryName.trim()}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8 },
  searchbar: { margin: 16, borderRadius: 12 },
  card: { marginHorizontal: 16, marginVertical: 6, borderRadius: 12, padding: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  cardMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  bulkAction: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, borderRadius: 16 }
});
