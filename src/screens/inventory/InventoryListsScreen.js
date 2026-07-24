import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Searchbar, FAB, List, useTheme, Text, ActivityIndicator, Dialog, Portal, TextInput, Button, IconButton, SegmentedButtons } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';

export default function InventoryListsScreen({ navigation }) {
  const theme = useTheme();
  const [lists, setLists] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const { hasPermission } = useAuthStore();
  const hasInventoryPermission = hasPermission('inventory');

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
      setIsAddDialogVisible(false);
      setNewListName('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create list');
    }
  };

  const handleArchiveToggle = (list, isArchived) => {
    Alert.alert(isArchived ? 'Archive List' : 'Restore List', `Are you sure you want to ${isArchived ? 'archive' : 'restore'} ${list.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: isArchived ? 'Archive' : 'Restore', style: isArchived ? 'destructive' : 'default', onPress: async () => {
          try {
            await InventoryService.archiveList(list.id, isArchived);
          } catch (e) {
            Alert.alert('Error', 'Failed to update list status');
          }
      }}
    ]);
  };

  const handleDeleteList = (list) => {
    Alert.alert('Delete List', `Are you sure you want to permanently delete "${list.name}"? All inventories and items inside it will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await InventoryService.deleteList(list.id);
          } catch (e) {
            Alert.alert('Error', 'Failed to delete list');
          }
      }}
    ]);
  };

  const filteredLists = lists.filter(l => 
    (activeTab === 'active' ? !l.isArchived : l.isArchived)
  );

  const getArchivedDescription = (list) => {
    if (!list.isArchived) return undefined;
    let desc = '';
    if (list.archivedAt) {
      const date = list.archivedAt.toDate ? list.archivedAt.toDate() : new Date(list.archivedAt);
      desc += `Archived on ${date.toLocaleDateString()}`;
    }
    if (list.archivedBy) {
      const user = usersList.find(u => u.id === list.archivedBy);
      desc += desc ? ` by ${user ? user.name : list.archivedBy}` : `Archived by ${user ? user.name : list.archivedBy}`;
    }
    return desc || 'Archived';
  };

  const renderNormalView = () => (
    <>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
          style={{ transform: [{ scale: 0.95 }] }}
        />
      </View>
      <FlatList
        data={filteredLists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <List.Item
            title={item.name || 'Unnamed List'}
            description={getArchivedDescription(item)}
            titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
            style={[{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8, elevation: 1 }, item.isArchived && { opacity: 0.7 }]}
            left={props => <List.Icon {...props} icon={item.isArchived ? "archive" : "format-list-bulleted-type"} color={item.isArchived ? theme.colors.onSurfaceVariant : theme.colors.primary} />}
            right={props => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.isArchived ? (
                  <IconButton icon="archive-arrow-up" size={20} iconColor={theme.colors.primary} onPress={() => handleArchiveToggle(item, false)} />
                ) : (
                  <IconButton icon="archive-arrow-down" size={20} iconColor={theme.colors.error} onPress={() => handleArchiveToggle(item, true)} />
                )}
                <IconButton icon="trash-can-outline" size={20} iconColor={theme.colors.error} onPress={() => handleDeleteList(item)} />
                <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />
              </View>
            )}
            onPress={() => navigation.navigate('InventoryDetail', { listId: item.id, listName: item.name })}
          />
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
            No {activeTab} lists found.
          </Text>
        }
      />
    </>
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
        data={combined}
        keyExtractor={(item) => item._type + '_' + item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        renderItem={({ item }) => {
          let icon = "help-circle";
          let color = theme.colors.onSurfaceVariant;
          let subtitle = "";
          let onPress = () => {};

          if (item._type === 'list') {
            icon = "format-list-bulleted-type";
            color = theme.colors.primary;
            subtitle = "List";
            onPress = () => navigation.navigate('InventoryDetail', { listId: item.id, listName: item.name });
          } else if (item._type === 'folder') {
            icon = "folder";
            color = theme.colors.secondary;
            subtitle = `Folder • In ${lists.find(l => l.id === item.listId)?.name || 'Unknown List'}`;
            onPress = () => navigation.navigate('FolderDetail', { inventoryId: item.id, inventoryName: item.name });
          } else if (item._type === 'item') {
            icon = "tools";
            color = theme.colors.tertiary;
            subtitle = `Item • Qty: ${item.quantity || 0}`;
            onPress = () => navigation.navigate('ItemDetail', { itemId: item.id, itemData: item });
          } else if (item._type === 'user') {
            icon = "account";
            color = theme.colors.tertiary;
            const heldInvs = allInvs.filter(inv => inv.heldBy === item.id);
            subtitle = `${item.email || ''} • Holds ${heldInvs.length} inventories`;
            onPress = () => {
              if (heldInvs.length > 0) {
                navigation.navigate('FolderDetail', { inventoryId: heldInvs[0].id, inventoryName: heldInvs[0].name });
              }
            };
          }

          return (
            <List.Item
              title={item.name}
              description={subtitle}
              titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
              style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8, elevation: 1 }}
              left={props => <List.Icon {...props} icon={icon} color={color} />}
              onPress={onPress}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
            No results found.
          </Text>
        }
      />
    );
  };

  if (!hasInventoryPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={80} color={theme.colors.error} style={{ marginBottom: 16 }} />
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, marginBottom: 8, fontWeight: 'bold' }}>Access Denied</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 32 }}>
          You don&apos;t have permission to view or manage the inventory. Please contact an administrator if you need access.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder={searchQuery ? "Global Search..." : `Search ${activeTab} lists globally...`}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
      />
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        searchQuery.trim() ? renderSearchResults() : renderNormalView()
      )}

      {activeTab === 'active' && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => setIsAddDialogVisible(true)}
        />
      )}

      <Portal>
        <Dialog visible={isAddDialogVisible} onDismiss={() => setIsAddDialogVisible(false)}>
          <Dialog.Title>New List</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="List Name"
              value={newListName}
              onChangeText={setNewListName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAddDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddList} disabled={!newListName.trim()}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, borderRadius: 16 },
});
