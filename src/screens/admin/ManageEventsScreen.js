import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Image, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { Calendar, Image as ImageIcon, CheckCircle2, Eye, EyeOff } from '../../lib/lucideIcons';
import { EventsService } from '../../services/events';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia, buildFolder } from '../../lib/mediaUpload';
import { 
  AppListItem, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppBadge, 
  AppSkeleton, 
  AppEmptyState,
  AppSection,
  AppCard
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const EMPTY_EVENT = {
  name: '',
  description: '',
  longDescription: '',
  image: '',
  galleryImages: [],
  status: 'upcoming',
  order: 0,
  isActive: true
};

export default function ManageEventsScreen() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_EVENT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = EventsService.subscribeToEvents((data) => {
      setEvents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_EVENT);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      description: item.description || '',
      longDescription: item.longDescription || '',
      image: item.image || '',
      galleryImages: item.galleryImages || [],
      status: item.status || 'upcoming',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', `Are you sure you want to permanently delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => EventsService.deleteEvent(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.name) {
      Alert.alert('Required', 'Please enter an event name first so we can create a designated storage folder for it.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({
        folder: buildFolder('events', formData.status, formData.name),
        allowsEditing: false,
      });

      if (result.canceled) return;

      if (result.ok) {
        setFormData(prev => ({ ...prev, image: result.url }));
      } else {
        Alert.alert('Upload Failed', result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.image) {
      Alert.alert('Required', 'Event Name and Cover Image are required fields.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        const oldEvent = events.find(e => e.id === editingId);
        await EventsService.updateEvent(editingId, oldEvent, dataToSave, user?.email);
      } else {
        await EventsService.addEvent(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save event details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const badgeVariant = !item.isActive ? "danger" : (item.status === 'upcoming' ? "success" : "secondary");
            const statusLabel = !item.isActive ? "Hidden" : item.status.toUpperCase();

            return (
              <AppListItem
                title={item.name || 'Unnamed Event'}
                description={`${item.description || 'No description'} • Order #${item.order}`}
                leftIcon={
                  item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumbImage} />
                  ) : (
                    <View style={styles.iconBox}>
                      <Calendar size={18} color="#38BDF8" />
                    </View>
                  )
                }
                rightElement={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant={badgeVariant}>{statusLabel}</AppBadge>
                  </View>
                }
                onPress={() => openEditModal(item)}
                onDelete={() => handleDelete(item)}
              />
            );
          }}
          ListEmptyComponent={
            <AppEmptyState
              title="No events scheduled"
              description="You haven't created any upcoming or past events for the website yet."
              actionLabel="Add First Event"
              onAction={openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="New Event"
        onPress={openAddModal}
      />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Event Specification' : 'Create New Event'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Event
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Event Name"
          value={formData.name}
          onChangeText={t => setFormData({...formData, name: t})}
          placeholder="e.g. AUVSI SUAS 2026 or Drone Racing League"
        />
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Status"
            value={formData.status}
            onChangeText={t => setFormData({...formData, status: t})}
            placeholder="upcoming or past"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Display Order (priority)"
            value={String(formData.order)}
            onChangeText={t => setFormData({...formData, order: t})}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Short Summary"
            value={formData.description}
            onChangeText={t => setFormData({...formData, description: t})}
            placeholder="Brief overview displayed on event cards"
            multiline
            numberOfLines={2}
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Detailed Description"
            value={formData.longDescription}
            onChangeText={t => setFormData({...formData, longDescription: t})}
            placeholder="Full event details and schedule"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.switchBox}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {formData.isActive ? <Eye size={16} color="#10B981" style={{ marginRight: 6 }} /> : <EyeOff size={16} color="#EF4444" style={{ marginRight: 6 }} />}
              <Text style={styles.switchTitle}>Publicly Visible</Text>
            </View>
            <Text style={styles.switchSub}>When disabled, this event is hidden from the public website.</Text>
          </View>
          <Switch 
            value={formData.isActive} 
            onValueChange={v => setFormData({...formData, isActive: v})}
            trackColor={{ false: appColors.border, true: appColors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <AppSection title="Cover Banner" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="surface" style={styles.imageCard}>
            {formData.image ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: formData.image }} style={styles.bannerPreview} />
                <View style={styles.imageSuccessBadge}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.imageSuccessText}>Uploaded to Cloud Storage</Text>
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={32} color={appColors.textMuted} />
                <Text style={styles.imageHelper}>No cover image uploaded yet.</Text>
              </View>
            )}
            <AppButton 
              variant="secondary" 
              onPress={handlePickImage} 
              loading={isSaving} 
              disabled={isSaving}
              style={{ marginTop: 12 }}
              icon={<ImageIcon size={16} color={appColors.textPrimary} />}
            >
              {formData.image ? 'Replace Cover Image' : 'Upload Cover Banner'}
            </AppButton>
          </AppCard>
        </AppSection>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  loadingContainer: {
    padding: appSpacing.xl,
  },
  listContent: {
    padding: appSpacing.xl,
    paddingBottom: 100,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: appRadius.md,
    backgroundColor: '#38BDF815',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: appRadius.md,
    backgroundColor: appColors.elevatedSurface,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    padding: appSpacing.lg,
    borderRadius: appRadius.md,
    marginTop: 20,
  },
  switchTitle: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  switchSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  imageCard: {
    padding: appSpacing.lg,
    alignItems: 'center',
  },
  imagePreviewWrap: {
    width: '100%',
    alignItems: 'center',
  },
  bannerPreview: {
    width: '100%',
    height: 140,
    borderRadius: appRadius.md,
    backgroundColor: appColors.background,
  },
  imageSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  imageSuccessText: {
    ...appTypography.captionBold,
    color: '#10B981',
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${appColors.background}80`,
  },
  imageHelper: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 8,
  },
});

