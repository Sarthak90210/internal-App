import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Box, Edit2, Trash2, Clock, User, Tag, Hash, Check } from '../../lib/lucideIcons';
import { InventoryService } from '../../services/inventory';
import { 
  AppCard, 
  AppSection, 
  AppButton, 
  AppInput, 
  AppBadge, 
  AppSkeleton 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function ItemDetailScreen({ route, navigation }) {
  const { itemId, itemData: initialItemData } = route.params;

  const [item, setItem] = useState(initialItemData || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', quantity: '0', category: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const inventoryId = initialItemData?.inventoryId;
    if (!inventoryId) {
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
  }, [itemId, initialItemData, initialItemData?.inventoryId]);

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
      setSaving(true);
      await InventoryService.updateItem(itemId, {
        name: editForm.name,
        quantity: parseInt(editForm.quantity, 10) || 0,
        category: editForm.category
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item details');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Equipment Item',
      'Are you sure you want to permanently delete this item? This action cannot be undone.',
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
      <View style={styles.loadingContainer}>
        <AppSkeleton width="100%" height={120} style={{ marginBottom: 16 }} />
        <AppSkeleton width="100%" height={200} />
      </View>
    );
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return String(timestamp);
    }
  };

  const renderMetadataRow = (label, value, icon) => {
    if (!value) return null;
    return (
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          {icon}
          <Text style={styles.metaLabel}>{label}</Text>
        </View>
        <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Box size={18} color="#A855F7" style={{ marginRight: 8 }} />
            <AppBadge variant={item.quantity > 0 ? "success" : "danger"}>
              {item.quantity > 0 ? "In Stock" : "Depleted"}
            </AppBadge>
          </View>
          <Text style={styles.itemTitle}>{isEditing ? "Edit Item Details" : item.name}</Text>
        </View>
        {!isEditing && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <AppButton 
              variant="secondary" 
              size="sm" 
              icon={<Edit2 size={14} color={appColors.textPrimary} />} 
              onPress={handleEditToggle}
            />
            <AppButton 
              variant="danger" 
              size="sm" 
              icon={<Trash2 size={14} color="#EF4444" />} 
              onPress={handleDelete}
            />
          </View>
        )}
      </View>

      {isEditing ? (
        <AppSection title="Modify Specification" style={{ marginTop: appSpacing.lg }}>
          <AppCard variant="elevated" style={styles.editCard}>
            <AppInput
              label="Item Name"
              value={editForm.name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
              placeholder="e.g. T-Motor Velox V2"
              autoFocus
            />
            <View style={{ marginTop: 16 }}>
              <AppInput
                label="Stock Quantity"
                value={editForm.quantity}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, quantity: text }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ marginTop: 16 }}>
              <AppInput
                label="Category / Tag"
                value={editForm.category}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, category: text }))}
                placeholder="e.g. Motors, ESC, Frame"
              />
            </View>
            
            <View style={styles.actionButtons}>
              <AppButton variant="ghost" onPress={handleEditToggle} style={{ flex: 1, marginRight: 8 }} disabled={saving}>
                Cancel
              </AppButton>
              <AppButton 
                variant="primary" 
                onPress={handleSave} 
                style={{ flex: 1 }} 
                loading={saving}
                icon={<Check size={16} color="#09090B" />}
              >
                Save Changes
              </AppButton>
            </View>
          </AppCard>
        </AppSection>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <AppCard variant="elevated" style={styles.statCard}>
              <View style={styles.statIconBox}>
                <Hash size={18} color="#38BDF8" />
              </View>
              <Text style={styles.statLabel}>Current Stock</Text>
              <Text style={styles.statValue}>{item.quantity || 0}</Text>
            </AppCard>

            <AppCard variant="elevated" style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#A855F715' }]}>
                <Tag size={18} color="#A855F7" />
              </View>
              <Text style={styles.statLabel}>Category</Text>
              <Text style={styles.statValueCategory} numberOfLines={1}>{item.category || 'General'}</Text>
            </AppCard>
          </View>

          <AppSection title="Audit & Lifecycle Metadata" style={{ marginTop: appSpacing.xl }}>
            <AppCard variant="surface" style={{ padding: appSpacing.lg }}>
              {renderMetadataRow(
                "Created By", 
                item.createdBy || 'System', 
                <User size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
              {renderMetadataRow(
                "Created At", 
                formatDate(item.createdAt), 
                <Clock size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
              {renderMetadataRow(
                "Last Updated By", 
                item.updatedBy, 
                <User size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
              {renderMetadataRow(
                "Last Updated At", 
                formatDate(item.updatedAt), 
                <Clock size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
              {renderMetadataRow(
                "Previous Updated By", 
                item.previousUpdatedBy, 
                <User size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
              {renderMetadataRow(
                "Previous Updated At", 
                formatDate(item.previousUpdatedAt), 
                <Clock size={14} color={appColors.textMuted} style={styles.metaIcon} />
              )}
            </AppCard>
          </AppSection>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: appColors.background,
  },
  contentScroll: {
    padding: appSpacing.xl,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: appColors.background,
    padding: appSpacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: {
    ...appTypography.sectionTitle,
    fontSize: 26,
    color: appColors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: appSpacing.lg,
  },
  statCard: {
    flex: 1,
    padding: appSpacing.lg,
    alignItems: 'flex-start',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: appRadius.sm,
    backgroundColor: '#38BDF815',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    ...appTypography.title,
    fontSize: 28,
    color: appColors.textPrimary,
  },
  statValueCategory: {
    ...appTypography.bodyBold,
    fontSize: 20,
    color: appColors.textPrimary,
  },
  editCard: {
    padding: appSpacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaIcon: {
    marginRight: 8,
  },
  metaLabel: {
    ...appTypography.body,
    color: appColors.textSecondary,
  },
  metaValue: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});

