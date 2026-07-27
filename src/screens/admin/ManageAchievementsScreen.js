import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Trophy, Image as ImageIcon, CheckCircle2, Award } from '../../lib/lucideIcons';
import { AchievementsService } from '../../services/achievements';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia, buildFolder } from '../../lib/mediaUpload';
import { 
  AppSearchBar, 
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

const EMPTY_ACHIEVEMENT = {
  title: '',
  year: '',
  description: '',
  images: [],
  order: 0
};

export default function ManageAchievementsScreen() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_ACHIEVEMENT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = AchievementsService.subscribeToAchievements((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const lowerQ = searchQuery.toLowerCase();
    return items.filter(t => t.title?.toLowerCase().includes(lowerQ) || t.year?.toString().includes(lowerQ));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_ACHIEVEMENT);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      title: item.title || '',
      description: item.description || '',
      year: item.year || '',
      images: item.images || [],
      order: item.order || 0
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Deletion', `Are you sure you want to permanently delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => AchievementsService.deleteAchievement(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.title) {
      Alert.alert('Title Required', 'Please enter an achievement title first so we can create a designated storage folder.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({
        folder: buildFolder('achievements', formData.title),
        allowsEditing: false,
      });

      if (result.canceled) return;

      if (result.ok) {
        setFormData(prev => ({ ...prev, images: [result.url] }));
      } else {
        Alert.alert('Upload Failed', result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.images || formData.images.length === 0) {
      Alert.alert('Required Fields', 'Achievement Title and at least one Showcase Image are required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await AchievementsService.updateAchievement(editingId, oldItem, dataToSave, user?.email);
      } else {
        await AchievementsService.addAchievement(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save achievement details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <AppSearchBar
          placeholder="Search achievements by title or year..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={84} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={84} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={84} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasImage = item.images && item.images.length > 0;
            return (
              <AppListItem
                title={item.title || 'Untitled Achievement'}
                description={`${item.description || 'No description provided'} • Order #${item.order}`}
                leftIcon={
                  hasImage ? (
                    <Image source={{ uri: item.images[0] }} style={styles.thumbImage} />
                  ) : (
                    <View style={styles.iconBox}>
                      <Trophy size={20} color="#8B5CF6" />
                    </View>
                  )
                }
                rightElement={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant="primary">
                      {item.year || 'N/A'}
                    </AppBadge>
                  </View>
                }
                onPress={() => openEditModal(item)}
                onDelete={() => handleDelete(item)}
              />
            );
          }}
          ListEmptyComponent={
            <AppEmptyState
              title="No achievements recorded"
              description={searchQuery ? "No results matched your search query." : "Document your competition milestones, awards, and records."}
              actionLabel={searchQuery ? undefined : "Record Achievement"}
              onAction={searchQuery ? undefined : openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="New Award"
        onPress={openAddModal}
      />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Achievement Record' : 'Record New Achievement'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Achievement
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Award / Milestone Title"
          value={formData.title}
          onChangeText={t => setFormData({...formData, title: t})}
          placeholder="e.g. 1st Place Autonomous Navigation - AUVSI SUAS"
        />
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Competition Year"
            value={formData.year}
            onChangeText={t => setFormData({...formData, year: t})}
            placeholder="e.g. 2025 or 2024-2025"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Display Priority Order"
            value={String(formData.order)}
            onChangeText={t => setFormData({...formData, order: t})}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Description & Context"
            value={formData.description}
            onChangeText={t => setFormData({...formData, description: t})}
            placeholder="Details about the competition, vehicle used, or scores achieved"
            multiline
            numberOfLines={3}
          />
        </View>

        <AppSection title="Award Photograph" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="surface" style={styles.imageCard}>
            {formData.images && formData.images.length > 0 ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: formData.images[0] }} style={styles.bannerPreview} />
                <View style={styles.imageSuccessBadge}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.imageSuccessText}>Uploaded to Cloud Storage</Text>
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Award size={32} color={appColors.textMuted} />
                <Text style={styles.imageHelper}>No award photo uploaded yet.</Text>
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
              {formData.images && formData.images.length > 0 ? 'Replace Photograph' : 'Upload Award Photo'}
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
  searchWrap: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 4,
  },
  loadingWrap: {
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
    backgroundColor: `${appColors.accent}15`,
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
    height: 160,
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
    height: 130,
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

