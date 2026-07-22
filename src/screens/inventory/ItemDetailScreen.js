import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTheme, Text, Card, Button, TextInput, IconButton, Divider } from 'react-native-paper';
import { InventoryService } from '../../services/inventory';
import { useAuthStore } from '../../stores/authStore';

export default function ItemDetailScreen({ route, navigation }) {
  const theme = useTheme();
  const { itemId, itemData: initialItemData } = route.params;
  const user = useAuthStore(state => state.user);

  const [item, setItem] = useState(initialItemData || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', quantity: '0', category: '' });

  useEffect(() => {
    const inventoryId = initialItemData?.inventoryId;
    if (!inventoryId) {
      // If we don't know the inventoryId, just use the initial data
      if (initialItemData) setItem(initialItemData);
      return;
    }

    const unsubscribe = InventoryService.subscribeToItems(inventoryId, (items) => {
      const foundItem = items.find(i => i.id === itemId);
      if (foundItem) {
        setItem(foundItem);
      }
    });
    
    return () => unsubscribe();
  }, [itemId, initialItemData?.inventoryId]);

  const handleEditToggle = () => {
    if (!isEditing && item) {
      setEditForm({
        name: item.name || '',
        quantity: item.quantity ? item.quantity.toString() : '0',
        category: item.category || ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    try {
      await InventoryService.updateItem(itemId, {
        name: editForm.name,
        quantity: parseInt(editForm.quantity, 10) || 0,
        category: editForm.category
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await InventoryService.deleteItem(itemId);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text>Loading or Item Not Found...</Text>
      </View>
    );
  }

  const renderMetadata = (label, value) => {
    if (!value) return null;
    return (
      <View style={styles.metadataRow}>
        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{label}:</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>{value}</Text>
      </View>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return String(timestamp);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Title 
          title={isEditing ? "Edit Item" : item.name} 
          titleVariant="titleLarge"
          right={(props) => (
            !isEditing && <IconButton {...props} icon="delete" iconColor={theme.colors.error} onPress={handleDelete} />
          )}
        />
        <Card.Content>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                label="Name"
                value={editForm.name}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Quantity"
                value={editForm.quantity}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, quantity: text }))}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label="Category"
                value={editForm.category}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, category: text }))}
                mode="outlined"
                style={styles.input}
              />
              <View style={styles.actionButtons}>
                <Button mode="outlined" onPress={handleEditToggle} style={styles.actionBtn}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={handleSave} style={styles.actionBtn}>
                  Save
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.detailsBlock}>
              <View style={styles.infoRow}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>Quantity:</Text>
                <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{item.quantity || 0}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>Category:</Text>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>{item.category || 'N/A'}</Text>
              </View>

              <Button mode="contained" onPress={handleEditToggle} style={styles.editButton}>
                Edit Details
              </Button>

              <Divider style={styles.divider} />
              
              <Text variant="titleSmall" style={[styles.metadataTitle, { color: theme.colors.primary }]}>Metadata</Text>
              <View style={styles.metadataContainer}>
                {renderMetadata('Created By', item.createdBy)}
                {renderMetadata('Created At', formatDate(item.createdAt))}
                {renderMetadata('Updated By', item.updatedBy)}
                {renderMetadata('Updated At', formatDate(item.updatedAt))}
                {renderMetadata('Previous Updated By', item.previousUpdatedBy)}
                {renderMetadata('Previous Updated At', formatDate(item.previousUpdatedAt))}
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 16, borderRadius: 12 },
  detailsBlock: { marginTop: 8, gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editButton: { marginTop: 16, borderRadius: 8 },
  editContainer: { gap: 12 },
  input: { backgroundColor: 'transparent' },
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  actionBtn: { borderRadius: 8, minWidth: 100 },
  divider: { marginVertical: 16 },
  metadataTitle: { marginBottom: 8, fontWeight: 'bold' },
  metadataContainer: { backgroundColor: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 8, gap: 4 },
  metadataRow: { flexDirection: 'row', alignItems: 'center' }
});
