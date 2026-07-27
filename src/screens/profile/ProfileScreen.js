import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Pressable, Image } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { Camera, ExternalLink, RefreshCw, LogOut, Mail } from '../../lib/lucideIcons';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../services/auth';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { TagsService } from '../../services/tags';
import { apiPost, fetchAdmins, syncUserPermissions, logAdminAction } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import { pickAndUploadMedia, ownProfileFolder } from '../../lib/mediaUpload';
import Constants from 'expo-constants';
import { useUpdateStore } from '../../stores/updateStore';
import { 
  AppCard, 
  AppButton, 
  AppInput, 
  AppChip, 
  AppBadge, 
  AppSection, 
  AppSkeleton 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

// Read the real app version/runtime from the bundled config so this label
// always matches app.json instead of drifting like the old hardcoded "v1.1.1".
const APP_VERSION = Constants.expoConfig?.version || '—';
const APP_RUNTIME = (() => {
  const rt = Constants.expoConfig?.runtimeVersion;
  return typeof rt === 'string' ? rt : rt?.policy;
})();

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ProfileScreen() {
  const { user: authUser, roles } = useAuthStore();
  const { checkForUpdate, isChecking, isDownloading } = useUpdateStore();
  
  const [profile, setProfile] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [tags, setTags] = useState([]);
  const [admins, setAdmins] = useState([]);
  
  const isSuperAdmin = admins.find(a => (a.email || '').toLowerCase() === (authUser?.email || '').toLowerCase())?.isSuperAdmin || false;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Track editing state in a ref so the Firestore subscription (whose closure
  // captures state at mount) can tell whether the user is mid-edit. Without
  // this, every snapshot (including our own writes from photo upload / save)
  // rebuilds editForm, resetting each TextInput's value and bouncing focus
  // to an adjacent field on Android.
  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);
  
  // Edit state
  const [editForm, setEditForm] = useState({});
  const [editCustomFields, setEditCustomFields] = useState({});
  
  // Migration state
  const [showMigration, setShowMigration] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [migrating, setMigrating] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  const showSnackbar = (message) => setSnackbar({ visible: true, message });

  useEffect(() => {
    if (!authUser?.email) return;

    let unsubUser = () => {};
    let unsubFields = () => {};
    let unsubTags = () => {};

    const loadData = async () => {
      try {
        unsubUser = UsersService.subscribeToUser(authUser.email, (data) => {
          setProfile(data);
          // Only hydrate the edit form from the snapshot when the user is NOT
          // actively editing. While editing, the local editForm is the source
          // of truth — overwriting it here (e.g. when our own photo upload or
          // save triggers a snapshot) would wipe typed text and steal focus.
          if (data && !isEditingRef.current) {
            setEditForm({
              name: data.name || '',
              image: data.image || '',
              roomNumber: data.roomNumber || '',
              jobTitle: data.jobTitle || '',
              linkedin: data.linkedin || '',
              github: data.github || '',
              tags: data.tags || [],
            });
            setEditCustomFields(data.customFields || {});
          }
          setLoading(false);
        });

        unsubFields = CustomFieldsService.subscribeToCustomFields((fields) => {
          setCustomFields(fields || []);
        });

        unsubTags = TagsService.subscribeToTags((tagsData) => {
          setTags(tagsData || []);
        });

        fetchAdmins().then(setAdmins).catch((err) => {
          console.warn('[ProfileScreen] Could not fetch admins list (local backend may be offline):', err.message);
        });
      } catch (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setLoading(false);
      }
    };

    loadData();

    return () => {
      unsubUser();
      unsubFields();
      unsubTags();
    };
  }, [authUser]);

  const handlePickImage = async () => {
    if (!authUser?.email) {
      Alert.alert('Not signed in', 'Your session has expired. Please sign in again.');
      return;
    }

    setUploadingImage(true);
    try {
      // ownProfileFolder() applies the exact same sanitisation the backend
      // uses for its permission check. Building this path by hand is what
      // broke profile uploads for every non-admin.
      const result = await pickAndUploadMedia({
        folder: ownProfileFolder(authUser.email),
      });

      if (result.canceled) return;

      if (!result.ok) {
        Alert.alert('Upload Failed', result.error);
        return;
      }

      setEditForm(prev => ({ ...prev, image: result.url }));

      // Persist immediately. Writing the URL only into editForm left the
      // picture sitting on Cloudinary but absent from the profile unless the
      // user went on to press Save — so reopening the app showed the old
      // avatar and the upload looked like it had silently failed.
      try {
        const email = authUser.email.toLowerCase();
        await UsersService.updateUser(email, { image: result.url }, false, email);
        showSnackbar('Profile picture updated');
      } catch (error) {
        console.error('Profile picture save error:', error);
        Alert.alert('Save Failed', 'The picture uploaded but could not be saved to your profile.');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // editForm starts as {} and is only hydrated once the Firestore snapshot
      // arrives, so every field is coerced before .trim() — saving before
      // hydration used to throw "Cannot read property 'trim' of undefined".
      const text = (value) => (value ?? '').trim();

      const updatedData = {
        name: text(editForm.name),
        image: text(editForm.image),
        roomNumber: text(editForm.roomNumber),
        jobTitle: text(editForm.jobTitle),
        linkedin: text(editForm.linkedin),
        github: text(editForm.github),
        customFields: editCustomFields,
        email: authUser.email.toLowerCase(),
        updatedAt: new Date().toISOString(),
      };
      
      if (isSuperAdmin) {
        updatedData.tags = expandTagIds(editForm.tags || [], tags);
      }
      
      await UsersService.updateUser(authUser.email.toLowerCase(), updatedData, false, authUser.email.toLowerCase());
      
      if (isSuperAdmin) {
        await syncUserPermissions(authUser.email.toLowerCase(), updatedData.tags, tags, admins);
        await logAdminAction('user_profile_updated', authUser.email.toLowerCase(), `Updated own profile`, { target: authUser.email.toLowerCase() });
      }
      
      showSnackbar('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save profile updates');
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tagId) => {
    setEditForm(prev => {
      const current = prev.tags || [];
      if (current.includes(tagId)) {
        return { ...prev, tags: current.filter(id => id !== tagId) };
      } else {
        const tag = tags.find(t => t.id === tagId);
        const granted = getGrantedTagIds(tag, tags);
        const toAdd = [tagId, ...granted].filter(id => !current.includes(id));
        return { ...prev, tags: [...current, ...toAdd] };
      }
    });
  };

  const handleMigrate = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter a new email address');
      return;
    }
    
    setMigrating(true);
    try {
      const res = await apiPost('/api/migrate/request', { newEmail: newEmail.trim() });
      if (res.ok) {
        Alert.alert('Success', `Verification email sent to ${newEmail.trim()}. Please check your inbox.`);
        setShowMigration(false);
        setNewEmail('');
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to request migration');
      }
    } catch (error) {
      console.error('Migration error:', error);
      Alert.alert('Error', 'An error occurred during migration request');
    } finally {
      setMigrating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => AuthService.logout() }
    ]);
  };

  const renderCustomFieldInput = (field) => {
    const value = editCustomFields[field.id] || '';
    return (
      <AppInput
        key={field.id}
        label={field.name}
        value={value.toString()}
        onChangeText={(text) => setEditCustomFields(prev => ({ ...prev, [field.id]: text }))}
        placeholder={field.description || `Enter ${field.name}...`}
        multiline={field.type === 'text'}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <AppCard style={{ padding: appSpacing.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppSkeleton width={64} height={64} borderRadius={32} style={{ marginRight: 16 }} />
              <View style={{ flex: 1 }}>
                <AppSkeleton width="60%" height={24} style={{ marginBottom: 8 }} />
                <AppSkeleton width="40%" height={14} />
              </View>
            </View>
          </AppCard>
          <AppCard style={{ height: 220, padding: appSpacing.xl }}>
            <AppSkeleton width="40%" height={20} style={{ marginBottom: 20 }} />
            <AppSkeleton width="100%" height={16} style={{ marginBottom: 12 }} />
            <AppSkeleton width="100%" height={16} style={{ marginBottom: 12 }} />
            <AppSkeleton width="80%" height={16} />
          </AppCard>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: appColors.textPrimary }}>Profile not found</Text>
      </View>
    );
  }

  const displayData = isEditing ? editForm : profile;
  const displayCustomFields = isEditing ? editCustomFields : (profile.customFields || {});
  const userTagIds = profile.tags || [];
  const resolvedTags = userTagIds.map(tagId => {
    const found = tags.find(t => t.id === tagId);
    return found ? found.name : null;
  }).filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Card 1: Top Hero */}
        <AppCard style={styles.heroCard} elevated={isEditing}>
          <View style={styles.heroRow}>
            <View style={styles.avatarWrapper}>
              {displayData.image ? (
                <Image source={{ uri: displayData.image }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(displayData.name || authUser?.email)}
                  </Text>
                </View>
              )}
              {isEditing && (
                <Pressable
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                  style={styles.cameraBtn}
                >
                  <Camera size={14} color="#09090B" />
                </Pressable>
              )}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.nameText}>{displayData.name || 'Unnamed Member'}</Text>
              <Text style={styles.emailText}>{profile.email}</Text>
              
              <View style={styles.badgeRow}>
                <AppBadge variant={(profile.status === 'active' || !profile.status) ? 'success' : 'warning'}>
                  {profile.status || 'Active'}
                </AppBadge>
                {roles?.admin && <AppBadge variant="admin" style={{ marginLeft: 6 }}>Admin</AppBadge>}
                {isSuperAdmin && <AppBadge variant="superAdmin" style={{ marginLeft: 6 }}>Super</AppBadge>}
              </View>
            </View>
          </View>

          <View style={styles.heroActions}>
            {!isEditing ? (
              <AppButton variant="secondary" size="sm" onPress={() => setIsEditing(true)}>
                Edit Profile
              </AppButton>
            ) : (
              <View style={styles.editBtnRow}>
                <AppButton 
                  variant="ghost" 
                  size="sm" 
                  onPress={() => { 
                    setIsEditing(false); 
                    setEditForm({ 
                      name: profile.name || '', 
                      image: profile.image || '', 
                      roomNumber: profile.roomNumber || '', 
                      jobTitle: profile.jobTitle || '', 
                      linkedin: profile.linkedin || '', 
                      github: profile.github || '', 
                      tags: profile.tags || [] 
                    }); 
                    setEditCustomFields(profile.customFields || {}); 
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                >
                  Cancel
                </AppButton>
                <AppButton 
                  variant="primary" 
                  size="sm" 
                  onPress={handleSave} 
                  loading={saving}
                  style={{ flex: 1 }}
                >
                  Save
                </AppButton>
              </View>
            )}
          </View>
        </AppCard>

        {/* Card 2: Information & Groups Section */}
        <AppSection title="Profile Information" subtitle="Personal details and team metadata">
          {isEditing ? (
            <View style={styles.editFormContainer}>
              <AppInput label="Full Name" value={editForm.name} onChangeText={t => setEditForm(prev => ({...prev, name: t}))} />
              <AppInput label="Room Number" value={editForm.roomNumber} onChangeText={t => setEditForm(prev => ({...prev, roomNumber: t}))} />
              <AppInput label="Job Title / Role" value={editForm.jobTitle} onChangeText={t => setEditForm(prev => ({...prev, jobTitle: t}))} />
              <AppInput label="LinkedIn URL" value={editForm.linkedin} onChangeText={t => setEditForm(prev => ({...prev, linkedin: t}))} autoCapitalize="none" keyboardType="url" />
              <AppInput label="GitHub URL" value={editForm.github} onChangeText={t => setEditForm(prev => ({...prev, github: t}))} autoCapitalize="none" keyboardType="url" />
              {customFields.map(renderCustomFieldInput)}

              {isSuperAdmin && tags.length > 0 && (
                <View style={styles.tagEditSection}>
                  <Text style={styles.subLabel}>Assign Groups & Tags</Text>
                  <View style={styles.chipWrap}>
                    {tags.map(tag => {
                      const isSelected = (editForm.tags || []).includes(tag.id);
                      return (
                        <AppChip
                          key={tag.id}
                          selected={isSelected}
                          onPress={() => handleTagToggle(tag.id)}
                        >
                          {tag.name}
                        </AppChip>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View>
              <InfoRow label="Room Number" value={profile.roomNumber || 'N/A'} />
              <InfoRow label="Job Title / Role" value={profile.jobTitle || 'N/A'} />
              <InfoRow label="LinkedIn" value={profile.linkedin || 'N/A'} isLink={!!profile.linkedin} />
              <InfoRow label="GitHub" value={profile.github || 'N/A'} isLink={!!profile.github} />
              
              {customFields.map((field, index) => {
                const val = displayCustomFields[field.id];
                const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
                return (
                  <InfoRow 
                    key={field.id} 
                    label={field.name} 
                    value={val || 'N/A'}
                    isLink={isUrl}
                    isLast={index === customFields.length - 1 && resolvedTags.length === 0}
                  />
                );
              })}

              {resolvedTags.length > 0 && (
                <View style={styles.tagDisplaySection}>
                  <Text style={styles.subLabel}>Assigned Groups</Text>
                  <View style={styles.chipWrap}>
                    {resolvedTags.map((tagName, i) => (
                      <AppChip key={i} selected={false}>{tagName}</AppChip>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </AppSection>

        {/* Card 3: System & Account Actions */}
        <AppSection title="System & Account">
          <View style={styles.actionRow}>
            <View>
              <Text style={styles.actionTitle}>App Version</Text>
              <Text style={styles.actionSub}>
                v{APP_VERSION}{APP_RUNTIME ? ` (Runtime ${APP_RUNTIME})` : ''}
              </Text>
            </View>
            <AppButton
              variant="secondary"
              size="sm"
              onPress={() => checkForUpdate(true)}
              loading={isChecking}
              disabled={isChecking || isDownloading}
              icon={<RefreshCw size={14} color={appColors.textPrimary} />}
            >
              Check Updates
            </AppButton>
          </View>

          <View style={styles.divider} />

          {!showMigration ? (
            <View style={styles.actionRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.actionTitle}>Email Address</Text>
                <Text style={styles.actionSub}>Migrate account to a different address</Text>
              </View>
              <AppButton
                variant="secondary"
                size="sm"
                onPress={() => setShowMigration(true)}
                icon={<Mail size={14} color={appColors.textPrimary} />}
              >
                Migrate Email
              </AppButton>
            </View>
          ) : (
            <View style={styles.migrationBox}>
              <Text style={styles.actionTitle}>Migrate Account Email</Text>
              <Text style={[styles.actionSub, { marginBottom: 12 }]}>
                Enter your new email address. We will send a verification link.
              </Text>
              <AppInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="new.email@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.editBtnRow}>
                <AppButton variant="ghost" size="sm" onPress={() => setShowMigration(false)} style={{ flex: 1, marginRight: 8 }}>
                  Cancel
                </AppButton>
                <AppButton variant="primary" size="sm" onPress={handleMigrate} loading={migrating} style={{ flex: 1 }}>
                  Request
                </AppButton>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: appColors.danger }]}>Sign Out</Text>
              <Text style={styles.actionSub}>End your current session</Text>
            </View>
            <AppButton
              variant="danger"
              size="sm"
              onPress={handleLogout}
              icon={<LogOut size={14} color={appColors.danger} />}
            >
              Sign Out
            </AppButton>
          </View>
        </AppSection>

        <View style={{ height: 110 }} />
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        // The floating tab bar sits at bottom: 24 and stands 62 tall, so a
        // default-positioned Snackbar renders behind it and reads as no
        // feedback at all.
        wrapperStyle={{ bottom: 96 }}
        style={{ backgroundColor: appColors.elevatedSurface, borderColor: appColors.border, borderWidth: 1 }}
      >
        <Text style={{ color: appColors.textPrimary }}>{snackbar.message}</Text>
      </Snackbar>
    </View>
  );
}

const InfoRow = ({ label, value, isLink, isLast = false }) => (
  <View style={[styles.infoRowContainer, isLast && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View style={styles.infoValueWrap}>
      <Text style={[styles.infoValue, isLink && styles.infoLink]} numberOfLines={2}>
        {value}
      </Text>
      {isLink && <ExternalLink size={14} color={appColors.accent} style={{ marginLeft: 6 }} />}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: appSpacing.xxl,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    padding: appSpacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: appColors.elevatedSurface,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...appTypography.sectionTitle,
    color: appColors.textPrimary,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: appColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: appColors.surface,
  },
  heroCopy: {
    flex: 1,
  },
  nameText: {
    ...appTypography.sectionTitle,
    fontSize: 20,
  },
  emailText: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroActions: {
    borderTopWidth: 1,
    borderTopColor: appColors.border,
    paddingTop: 14,
  },
  editBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editFormContainer: {
    paddingTop: 4,
  },
  infoRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  infoLabel: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    flex: 1,
  },
  infoValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  infoValue: {
    ...appTypography.body,
    fontWeight: '500',
    textAlign: 'right',
  },
  infoLink: {
    color: appColors.accent,
  },
  tagDisplaySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  tagEditSection: {
    marginTop: 8,
  },
  subLabel: {
    ...appTypography.metadata,
    textTransform: 'uppercase',
    color: appColors.textMuted,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  actionTitle: {
    ...appTypography.body,
    fontWeight: '600',
  },
  actionSub: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.border,
    marginVertical: 14,
  },
  migrationBox: {
    backgroundColor: appColors.elevatedSurface,
    padding: appSpacing.lg,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
  },
});

