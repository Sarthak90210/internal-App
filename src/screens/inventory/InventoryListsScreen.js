import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Searchbar, FAB, List, useTheme, Text, ActivityIndicator } from 'react-native-paper';
import { InventoryService } from '../../services/inventory';

export default function InventoryListsScreen({ navigation }) {
  const theme = useTheme();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Local search query for this screen, or global if we want it to persist across tabs
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = InventoryService.subscribeToLists((data) => {
      setLists(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredLists = lists.filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search Lists..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
        inputStyle={{ color: theme.colors.onSurface }}
        iconColor={theme.colors.onSurfaceVariant}
      />
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={filteredLists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <List.Item
              title={item.name || 'Unnamed List'}
              titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
              style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8 }}
              left={props => <List.Icon {...props} icon="format-list-bulleted-type" color={theme.colors.primary} />}
              right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={() => navigation.navigate('InventoryDetail', { listId: item.id, listName: item.name })}
            />
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No lists found.
            </Text>
          }
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => {
          // Future: open modal to add list
          console.log('Add List');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 16, borderRadius: 12 },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});
