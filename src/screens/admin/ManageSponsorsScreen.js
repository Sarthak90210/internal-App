import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Image, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { Settings, Image as ImageIcon, FileText, Upload, CheckCircle2, Eye, EyeOff, DollarSign } from '../../lib/lucideIcons';
import { SponsorsService } from '../../services/sponsors';
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

const EMPTY_SPONSOR = {
  name: '',
  website: '',
  logo: '',
  order: 0,
  isActive: true
};

const DEFAULT_PAGE_SETTINGS = {
  title: 'Sponsor Us',
  description: '',
  teamImage: { url: '', publicId: '' },
  brochure: { url: '', publicId: '', name: '' },
  whySponsorUs: ''
};

export default function ManageSponsorsScreen() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SPONSOR);
  const [isSaving, setIsSaving] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);

  useEffect(() => {
    const unsubscribeSponsors = SponsorsService.subscribeToSponsors((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubscribeSettings = SponsorsService.subscribeToSponsorSettings((data) => {
      setPageSettings(data);
    });
    return () => {
      unsubscribeSponsors();
      unsubscribeSettings();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const lowerQ = searchQuery.toLowerCase();
    return items.filter(t => t.name?.toLowerCase().includes(lowerQ));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_SPONSOR);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      website: item.website || '',
      logo: item.logo || '',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Remove Sponsor', `Are you sure you want to remove "${item.name}" from the sponsor showcase?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => SponsorsService.deleteSponsor(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.name) {
      Alert.alert('Required Name', 'Please enter a sponsor name first to create a dedicated cloud folder.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({
        folder: buildFolder('sponsors', formData.name),
        allowsEditing: false,
      });

      if (result.canceled) return;

      if (result.ok) {
        setFormData(prev => ({ ...prev, logo: result.url }));
      } else {
        Alert.alert('Upload Failed', result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.logo) {
      Alert.alert('Required Fields', 'Sponsor Name and Logo are required to display on the website.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await SponsorsService.updateSponsor(editingId, oldItem, dataToSave, user?.email);
      } else {
        await SponsorsService.addSponsor(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save sponsor details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await SponsorsService.updateSponsorSettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      Alert.alert('Success', 'Sponsor page narrative and brochure updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to save sponsor page settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async (type) => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({
        folder: type === 'teamImage' ? 'sponsor-us/team-image' : 'sponsor-us',
        mediaTypes: type === 'brochure' ? ['images', 'videos'] : ['images'],
        allowsEditing: false,
      });

      if (result.canceled) return;

      if (!result.ok) {
        Alert.alert('Upload Failed', result.error);
        return;
      }

      if (type === 'teamImage') {
        setPageSettings(prev => ({
          ...prev,
          teamImage: { url: result.url, publicId: result.publicId },
        }));
      } else {
        setPageSettings(prev => ({
          ...prev,
          brochure: { url: result.url, publicId: result.publicId, name: 'Sponsorship_Brochure.pdf' },
        }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <AppSearchBar
            placeholder="Search sponsors by company name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <AppButton 
          variant="secondary" 
          icon={<Settings size={16} color={appColors.textPrimary} />} 
          onPress={() => setSettingsModalVisible(true)}
        >
          Page Config
        </AppButton>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={80} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasLogo = !!item.logo;
            return (
              <AppListItem
                title={item.name || 'Untitled Sponsor'}
                description={`${item.website || 'No website specified'} • Priority #${item.order}`}
                leftIcon={
                  hasLogo ? (
                    <View style={styles.logoBox}>
                      <Image source={{ uri: item.logo }} style={styles.logoImg} resizeMode="contain" />
                    </View>
                  ) : (
                    <View style={[styles.iconBox, { backgroundColor: '#10B98115' }]}>
                      <DollarSign size={20} color="#10B981" />
                    </View>
                  )
                }
                rightElement={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant={item.isActive !== false ? 'success' : 'danger'}>
                      {item.isActive !== false ? 'ACTIVE' : 'HIDDEN'}
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
              title="No Sponsors Listed"
              description={searchQuery ? "No sponsors matched your search criteria." : "Add corporate partners and sponsors to display on the public landing page."}
              actionLabel={searchQuery ? undefined : "Add First Sponsor"}
              onAction={searchQuery ? undefined : openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="Add Partner"
        onPress={openAddModal}
      />

      {/* Sponsor Add/Edit Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Sponsor Profile' : 'Add Corporate Sponsor'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Partner Profile
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Company / Partner Name"
          value={formData.name}
          onChangeText={t => setFormData({...formData, name: t})}
          placeholder="e.g. Altium, SolidWorks, BetaFPV"
        />
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Website URL"
            value={formData.website}
            onChangeText={t => setFormData({...formData, website: t})}
            placeholder="https://www.sponsor.com"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Display Priority Order"
            value={String(formData.order)}
            onChangeText={t => setFormData({...formData, order: t})}
            keyboardType="numeric"
            placeholder="0 (lower numbers appear first)"
          />
        </View>

        <View style={styles.switchBox}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {formData.isActive ? <Eye size={16} color="#10B981" style={{ marginRight: 6 }} /> : <EyeOff size={16} color="#EF4444" style={{ marginRight: 6 }} />}
              <Text style={styles.switchTitle}>Showcase Status</Text>
            </View>
            <Text style={styles.switchSub}>If disabled, logo is hidden from the public website.</Text>
          </View>
          <Switch 
            value={formData.isActive} 
            onValueChange={v => setFormData({...formData, isActive: v})}
            trackColor={{ false: appColors.border, true: appColors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <AppSection title="Company Logo (.png / .svg / .jpg)" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="surface" style={styles.imageCard}>
            {formData.logo ? (
              <View style={styles.imagePreviewWrap}>
                <View style={styles.logoPreviewContainer}>
                  <Image source={{ uri: formData.logo }} style={styles.logoPreview} resizeMode="contain" />
                </View>
                <View style={styles.imageSuccessBadge}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.imageSuccessText}>Uploaded to Cloud Storage</Text>
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={32} color={appColors.textMuted} />
                <Text style={styles.imageHelper}>No partner logo uploaded yet.</Text>
              </View>
            )}
            <AppButton 
              variant="secondary" 
              onPress={handlePickImage} 
              loading={isSaving} 
              disabled={isSaving}
              style={{ marginTop: 12 }}
              icon={<Upload size={16} color={appColors.textPrimary} />}
            >
              {formData.logo ? 'Replace Logo Asset' : 'Upload Logo Asset'}
            </AppButton>
          </AppCard>
        </AppSection>
      </AppModal>

      {/* Sponsor Page Settings Modal */}
      <AppModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        title="Sponsor Us Page Narrative"
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setSettingsModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSaveSettings} style={{ flex: 1 }} loading={isSaving}>
              Save Page Settings
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Page Intro & Description"
          value={pageSettings.description}
          onChangeText={t => setPageSettings({...pageSettings, description: t})}
          placeholder="Tell prospective sponsors why supporting Team Rotor FPV accelerates aerospace engineering..."
          multiline
          numberOfLines={4}
        />
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Why Sponsor Us (Value Proposition)"
            value={pageSettings.whySponsorUs}
            onChangeText={t => setPageSettings({...pageSettings, whySponsorUs: t})}
            placeholder="Detail the recruitment access, branding on competition drones, and media reach..."
            multiline
            numberOfLines={5}
          />
        </View>

        <AppSection title="Team Showcase Photograph" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="surface" style={styles.imageCard}>
            {pageSettings.teamImage?.url ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: pageSettings.teamImage.url }} style={styles.bannerPreview} />
                <View style={styles.imageSuccessBadge}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.imageSuccessText}>Team Image Active</Text>
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={32} color={appColors.textMuted} />
                <Text style={styles.imageHelper}>No hero team photograph uploaded.</Text>
              </View>
            )}
            <AppButton 
              variant="secondary" 
              onPress={() => handlePickSettingsImage('teamImage')} 
              loading={isSaving} 
              disabled={isSaving}
              style={{ marginTop: 12 }}
              icon={<Upload size={16} color={appColors.textPrimary} />}
            >
              Upload Team Photo
            </AppButton>
          </AppCard>
        </AppSection>

        <AppSection title="Sponsorship Prospectus Brochure (.pdf / doc)" style={{ marginTop: appSpacing.xl }}>
          <AppCard variant="surface" style={styles.brochureCard}>
            <View style={styles.brochureRow}>
              <View style={[styles.iconBox, { backgroundColor: '#38BDF815', marginRight: 12 }]}>
                <FileText size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brochureTitle}>
                  {pageSettings.brochure?.url ? (pageSettings.brochure.name || 'Sponsorship_Brochure.pdf') : 'No Brochure Attached'}
                </Text>
                <Text style={styles.brochureSub}>
                  {pageSettings.brochure?.url ? 'Available for download on the Sponsor Us page' : 'Upload your sponsorship tier prospectus'}
                </Text>
              </View>
            </View>
            <AppButton 
              variant="secondary" 
              onPress={() => handlePickSettingsImage('brochure')} 
              loading={isSaving} 
              disabled={isSaving}
              style={{ marginTop: 14, width: '100%' }}
              icon={<Upload size={16} color={appColors.textPrimary} />}
            >
              {pageSettings.brochure?.url ? 'Replace Brochure File' : 'Upload Brochure PDF'}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: appRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  logoImg: {
    width: '100%',
    height: '100%',
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
  logoPreviewContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: appRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: appColors.border,
  },
  logoPreview: {
    width: '100%',
    height: '100%',
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
    height: 110,
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
  brochureCard: {
    padding: appSpacing.lg,
  },
  brochureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brochureTitle: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  brochureSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
});

