import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Image, Pressable, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { Image as ImageIcon, Edit2, Trash2, Sparkles, CheckCircle2, LayoutGrid, Hash } from '../../lib/lucideIcons';
import { GalleryService } from '../../services/gallery';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia } from '../../lib/mediaUpload';
import { 
  AppCard, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppSkeleton, 
  AppEmptyState,
  AppSection 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const EMPTY_GALLERY = {
  img: '',
  order: 0,
  originalWidth: null,
  originalHeight: null
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - appSpacing.xl * 2 - 12) / 2;

export default function ManageGalleryScreen() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_GALLERY);
  const [isSaving, setIsSaving] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState({ heroImageUrl: '' });

  useEffect(() => {
    const unsubscribeGallery = GalleryService.subscribeToGallery((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubscribeSettings = GalleryService.subscribeToGallerySettings((data) => {
      setPageSettings(data);
    });
    return () => {
      unsubscribeGallery();
      unsubscribeSettings();
    };
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_GALLERY);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      img: item.img || '',
      order: item.order || 0,
      originalWidth: item.originalWidth || null,
      originalHeight: item.originalHeight || null
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to permanently delete this gallery image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => GalleryService.deleteGalleryItem(item) }
    ]);
  };

  const handlePickImage = async () => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: 'gallery', allowsEditing: false });

      if (result.canceled) return;

      if (result.ok) {
        setFormData(prev => ({
          ...prev,
          img: result.url,
          originalWidth: result.width || 600,
          originalHeight: result.height || 400
        }));
      } else {
        Alert.alert('Upload Failed', result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.img) {
      Alert.alert('Required', 'An image upload is required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { 
        ...formData, 
        order: Number(formData.order),
        originalWidth: formData.originalWidth || 600,
        originalHeight: formData.originalHeight || 400
      };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await GalleryService.updateGalleryItem(editingId, oldItem, dataToSave, user?.email);
      } else {
        await GalleryService.addGalleryItem(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save gallery item details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await GalleryService.updateGallerySettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      Alert.alert('Success', 'Gallery page hero settings updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async () => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: 'gallery', allowsEditing: false });

      if (result.canceled) return;

      if (result.ok) {
        setPageSettings({ heroImageUrl: result.url });
      } else {
        Alert.alert('Upload Failed', result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <AppCard variant="elevated" style={styles.heroCard}>
        <View style={styles.heroCardContent}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Sparkles size={16} color={appColors.accent} style={{ marginRight: 6 }} />
              <Text style={styles.heroBadge}>Website Header</Text>
            </View>
            <Text style={styles.heroTitle}>Gallery Hero Image</Text>
            <Text style={styles.heroSub}>Configure the main showcase banner displayed at the top of the gallery page.</Text>
          </View>
          <AppButton 
            variant="secondary" 
            size="sm" 
            onPress={() => setSettingsModalVisible(true)}
            icon={<Edit2 size={14} color={appColors.textPrimary} />}
          >
            Configure
          </AppButton>
        </View>
        {pageSettings.heroImageUrl ? (
          <Image source={{ uri: pageSettings.heroImageUrl }} style={styles.heroThumb} />
        ) : null}
      </AppCard>

      <View style={styles.gridHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LayoutGrid size={18} color="#38BDF8" style={{ marginRight: 8 }} />
          <Text style={styles.gridTitle}>Gallery Grid ({items.length})</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={140} style={{ marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppSkeleton width="48%" height={180} />
            <AppSkeleton width="48%" height={180} />
          </View>
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <Pressable 
              style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={() => openEditModal(item)}
            >
              {item.img ? (
                <Image source={{ uri: item.img }} style={styles.gridImage} />
              ) : (
                <View style={styles.placeholderGridImage}>
                  <ImageIcon size={28} color={appColors.textMuted} />
                </View>
              )}
              <View style={styles.imageOverlay}>
                <View style={styles.orderBadge}>
                  <Hash size={10} color={appColors.textPrimary} />
                  <Text style={styles.orderText}>{item.order}</Text>
                </View>
                <View style={styles.overlayActions}>
                  <Pressable 
                    style={styles.actionBtn} 
                    onPress={(e) => { e.stopPropagation(); openEditModal(item); }}
                  >
                    <Edit2 size={14} color="#FFFFFF" />
                  </Pressable>
                  <Pressable 
                    style={[styles.actionBtn, { backgroundColor: '#EF444430' }]} 
                    onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <AppEmptyState
              title="No gallery images"
              description="Upload your team's action shots and drone photographs to showcase on the web."
              actionLabel="Add Gallery Image"
              onAction={openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="Add Image"
        onPress={openAddModal}
      />

      {/* Item Edit Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Gallery Image' : 'Upload Gallery Image'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Image
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Display Order (priority)"
          value={String(formData.order)}
          onChangeText={t => setFormData({...formData, order: t})}
          keyboardType="numeric"
          placeholder="0"
        />
        
        <AppSection title="Image File" style={{ marginTop: appSpacing.lg }}>
          <AppCard variant="surface" style={styles.modalImageCard}>
            {formData.img ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Image source={{ uri: formData.img }} style={styles.previewImage} />
                <View style={styles.successBadge}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.successText}>Uploaded ({formData.originalWidth}x{formData.originalHeight})</Text>
                </View>
              </View>
            ) : (
              <View style={styles.modalPlaceholder}>
                <ImageIcon size={32} color={appColors.textMuted} />
                <Text style={styles.placeholderHelper}>No image selected yet.</Text>
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
              {formData.img ? 'Replace Image' : 'Select From Photo Library'}
            </AppButton>
          </AppCard>
        </AppSection>
      </AppModal>

      {/* Hero Settings Modal */}
      <AppModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        title="Gallery Page Hero Banner"
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setSettingsModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSaveSettings} style={{ flex: 1 }} loading={isSaving}>
              Update Banner
            </AppButton>
          </View>
        }
      >
        <Text style={styles.modalHelper}>
          This image serves as the full-width header background for visitors browsing the gallery page on the website.
        </Text>
        
        <AppCard variant="surface" style={styles.modalImageCard}>
          {pageSettings.heroImageUrl ? (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Image source={{ uri: pageSettings.heroImageUrl }} style={styles.previewImage} />
              <View style={styles.successBadge}>
                <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={styles.successText}>Hero Banner Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.modalPlaceholder}>
              <ImageIcon size={32} color={appColors.textMuted} />
              <Text style={styles.placeholderHelper}>No hero banner configured.</Text>
            </View>
          )}
          <AppButton 
            variant="secondary" 
            onPress={handlePickSettingsImage} 
            loading={isSaving} 
            disabled={isSaving}
            style={{ marginTop: 12 }}
            icon={<ImageIcon size={16} color={appColors.textPrimary} />}
          >
            {pageSettings.heroImageUrl ? 'Replace Hero Banner' : 'Upload Hero Banner'}
          </AppButton>
        </AppCard>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  loadingWrap: {
    padding: appSpacing.xl,
  },
  listContent: {
    paddingHorizontal: appSpacing.xl,
    paddingBottom: 100,
  },
  headerContainer: {
    paddingTop: appSpacing.lg,
    marginBottom: appSpacing.lg,
  },
  heroCard: {
    padding: appSpacing.lg,
    marginBottom: 24,
  },
  heroCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBadge: {
    ...appTypography.captionBold,
    color: appColors.accent,
  },
  heroTitle: {
    ...appTypography.bodyBold,
    fontSize: 18,
    color: appColors.textPrimary,
  },
  heroSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 4,
  },
  heroThumb: {
    width: '100%',
    height: 100,
    borderRadius: appRadius.sm,
    marginTop: 14,
    backgroundColor: appColors.background,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    ...appTypography.sectionTitle,
    fontSize: 20,
    color: appColors.textPrimary,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: COLUMN_WIDTH,
    height: 160,
    borderRadius: appRadius.md,
    backgroundColor: appColors.elevatedSurface,
    borderWidth: 1,
    borderColor: appColors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderGridImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surface,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09090BCC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: `${appColors.border}80`,
  },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: appRadius.pill,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  orderText: {
    ...appTypography.captionBold,
    fontSize: 11,
    color: appColors.textPrimary,
    marginLeft: 3,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${appColors.secondary}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalImageCard: {
    padding: appSpacing.lg,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: appRadius.md,
    backgroundColor: appColors.background,
    resizeMode: 'cover',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  successText: {
    ...appTypography.captionBold,
    color: '#10B981',
  },
  modalPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${appColors.background}80`,
  },
  placeholderHelper: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 8,
  },
  modalHelper: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 16,
  },
});

