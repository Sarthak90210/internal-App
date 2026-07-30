import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Box, Edit2, Trash2, Clock, User, Tag, Hash, Check, UserCheck, CornerDownRight } from '../../lib/lucideIcons';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import AttachTagModal from '../../components/AttachTagModal';
import { resolveEffectiveHolder } from '../../lib/custody';
import { getHolderName } from '../../lib/inventoryHelpers';
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
  const { user, hasPermission } = useAuthStore();
  const [replaceVisible, setReplaceVisible] = useState(false);

  const [item, setItem] = useState(initialItemData || null);
  const [allInvs, setAllInvs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', quantity: '0', category: '' });
  const [saving, setSaving] = useState(false);
  const [custodyBusy, setCustodyBusy] = useState(false);

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

  // Needed to resolve the item's effective holder (it may inherit the holder of
  // an ancestor folder) and to display holder names.
  useEffect(() => {
    const unsubInvs = InventoryService.subscribeToAllInventories((data) => setAllInvs(data));
    const unsubUsers = UsersService.subscribeToUsers((data) => setUsersList(data));
    return () => {
      unsubInvs();
      unsubUsers();
    };
  }, []);

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

  // Custody: an item can be held on its own (decision: whole-stack hold). An
  // explicit holder overrides the inherited folder holder; releasing reverts it.
  const holderInfo = resolveEffectiveHolder(item, 'item', allInvs);
  const myEmail = user?.email;
  const iHoldExplicitly = item?.currentHolder && item.currentHolder === myEmail;

  const doHold = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.holdItem(itemId, myEmail);
    } catch (error) {
      console.error('Error holding item:', error);
      Alert.alert('Error', 'Could not hold this item. Please try again.');
    } finally {
      setCustodyBusy(false);
    }
  };

  const handleHold = () => {
    if (!myEmail) return;
    // Grab-with-warning: only when someone ELSE explicitly holds it.
    if (item?.currentHolder && item.currentHolder !== myEmail) {
      Alert.alert(
        'Take custody?',
        `This item is currently held by ${getHolderName(item.currentHolder, usersList)}. Take it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take it', style: 'destructive', onPress: doHold },
        ]
      );
    } else {
      doHold();
    }
  };

  const handleRelease = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.releaseItem(itemId);
    } catch (error) {
      console.error('Error releasing item:', error);
      Alert.alert('Error', 'Could not release this item. Please try again.');
    } finally {
      setCustodyBusy(false);
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
          <AppSection title="Custody" style={{ marginTop: appSpacing.lg }}>
            <AppCard variant="elevated" style={{ padding: appSpacing.lg }}>
              <View style={styles.custodyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custodyLabel}>Held by</Text>
                  <Text style={styles.custodyValue}>
                    {holderInfo.holder ? getHolderName(holderInfo.holder, usersList) : 'Unassigned'}
                  </Text>
                  {holderInfo.source === 'inherited' && (
                    <View style={styles.inheritedRow}>
                      <CornerDownRight size={12} color={appColors.textMuted} />
                      <Text style={styles.inheritedText}>via {holderInfo.from?.name || 'parent folder'}</Text>
                    </View>
                  )}
                </View>
                {iHoldExplicitly ? (
                  <AppButton variant="secondary" size="sm" onPress={handleRelease} loading={custodyBusy}>
                    Release
                  </AppButton>
                ) : (
                  <AppButton
                    variant="primary"
                    size="sm"
                    onPress={handleHold}
                    loading={custodyBusy}
                    icon={<UserCheck size={14} color="#09090B" />}
                  >
                    Hold this
                  </AppButton>
                )}
              </View>
              <View style={styles.tagRow}>
                <Text style={styles.custodyLabel}>QR Tag</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={styles.tagValue}>{item.activeTagId || 'None'}</Text>
                  {hasPermission('inventory') && (
                    <AppButton variant="ghost" size="sm" onPress={() => setReplaceVisible(true)}>
                      {item.activeTagId ? 'Replace' : 'Attach'}
                    </AppButton>
                  )}
                </View>
              </View>
            </AppCard>
          </AppSection>

          <AttachTagModal
            visible={replaceVisible}
            entity={{ type: 'item', id: itemId, name: item.name }}
            mode={item.activeTagId ? 'replace' : 'attach'}
            onClose={() => setReplaceVisible(false)}
          />

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
  custodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  custodyLabel: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    marginBottom: 4,
  },
  custodyValue: {
    ...appTypography.bodyBold,
    fontSize: 18,
    color: appColors.textPrimary,
  },
  inheritedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  tagValue: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
    fontFamily: 'monospace',
  },
  inheritedText: {
    ...appTypography.caption,
    color: appColors.textMuted,
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

