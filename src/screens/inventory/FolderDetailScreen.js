import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Searchbar, FAB, List, useTheme, Text, ActivityIndicator, SegmentedButtons, Checkbox, Badge } from 'react-native-paper';
import { InventoryService } from '../../services/inventory';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function FolderDetailScreen({ route, navigation }) {
  const theme = useTheme();
  const { inventoryId, inventoryName } = route.params;
  const [items, setItems] = useState([]);
  const [subInventories, setSubInventories] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    navigation.setOptions({ title: inventoryName || 'Folder' });
    const unsubscribeItems = InventoryService.subscribeToItems(inventoryId, (data) => setItems(data));
    const unsubscribeSubInvs = InventoryService.subscribeToSubInventories(inventoryId, (data) => setSubInventories(data));
    const unsubscribeAllInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    InventoryService.getAllItems().then(data => setAllItems(data));
    
    const unsubscribeHistory = InventoryService.subscribeToHistory(inventoryId, (data) => setHistory(data));

    // Wait a brief moment to assume initial loads are done
    setTimeout(() => setLoading(false), 800);

    return () => {
      unsubscribeItems();
      unsubscribeSubInvs();
      unsubscribeAllInvs();
      unsubscribeHistory();
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

  const renderOverview = () => {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>{currentInventory.name}</Text>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 120 }}>Status:</Text>
          <Text>{currentInventory.status || (currentInventory.currentHolder ? 'CheckedOut' : 'Available')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 120 }}>Current Holder:</Text>
          <Text>{currentInventory.currentHolder || 'None'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 120 }}>Current Room:</Text>
          <Text>{currentInventory.currentRoom || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 120 }}>Total Items:</Text>
          <Text>{calculateDescendantItemCount(inventoryId)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={{ fontWeight: 'bold', width: 120 }}>Created By:</Text>
          <Text>{currentInventory.createdBy || 'N/A'}</Text>
        </View>
      </ScrollView>
    );
  };

  const renderSubInventories = () => {
    const filtered = subInventories.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        renderItem={({ item }) => {
          const count = calculateDescendantItemCount(item.id);
          const status = item.status || (item.currentHolder ? 'CheckedOut' : 'Available');
          const holder = item.currentHolder || 'None';

          return (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => navigation.push('FolderDetail', { inventoryId: item.id, inventoryName: item.name })}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" style={{ flex: 1, fontWeight: 'bold' }}>{item.name || 'Unnamed Folder'}</Text>
                <View style={[styles.badge, { backgroundColor: status === 'Available' ? theme.colors.primaryContainer : theme.colors.errorContainer }]}>
                  <Text style={{ fontSize: 10, color: status === 'Available' ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer }}>{status}</Text>
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
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No sub-inventories found.</Text>}
      />
    );
  };

  const renderItems = () => {
    const filtered = items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        renderItem={({ item }) => (
          <List.Item
            title={item.name || 'Unnamed Item'}
            description={`Qty: ${item.quantity || 0}`}
            titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8, elevation: 1 }}
            left={props => <List.Icon {...props} icon="tools" color={theme.colors.secondary} />}
            onPress={() => navigation.navigate('ItemDetail', { itemId: item.id, itemData: item })}
          />
        )}
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
        renderItem={({ item }) => (
          <View style={{ marginBottom: 16, borderLeftWidth: 2, borderLeftColor: theme.colors.primary, paddingLeft: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>{item.action}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>{item.timestamp?.toLocaleString()}</Text>
            <Text style={{ marginTop: 4 }}>{item.details}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No history logs found.</Text>}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'overview', label: 'Overview' },
            { value: 'sub', label: 'Sub Inv' },
            { value: 'items', label: 'Items' },
            { value: 'history', label: 'History' },
          ]}
          style={{ transform: [{ scale: 0.9 }] }}
        />
      </View>

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

      {(activeTab === 'sub' || activeTab === 'items') && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => console.log('Add new')}
        />
      )}
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
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }
});
