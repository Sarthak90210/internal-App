import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Avatar, Text, useTheme, Button, TextInput, Chip, Divider, Surface, IconButton, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../services/auth';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { TagsService } from '../../services/tags';
import { uploadFile, apiPost, fetchAdmins, syncUserPermissions, logAdminAction } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import * as ImagePicker from 'expo-image-picker';
import { useUpdateStore } from '../../stores/updateStore';

// Helper to get initials
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ProfileScreen() {
  const theme = useTheme();
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
          if (data) {
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
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } catch (error) {
      console.error('Image picking error:', error);
      Alert.alert('Error', 'Failed to pick image');
      return;
    }

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const uri = result.assets[0].uri;
        const folder = `users/${authUser.email.toLowerCase()}`;
        const response = await uploadFile(uri, folder);
        
        if (response.ok && response.data?.secure_url) {
          setEditForm(prev => ({ ...prev, image: response.data.secure_url }));
          showSnackbar('Profile image uploaded successfully');
        } else {
          Alert.alert('Upload Failed', response.data?.error || 'Failed to upload image.');
        }
      } catch (error) {
        console.error('Image upload error:', error);
        Alert.alert('Upload Failed', error.message || 'Failed to upload image.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedData = {
        name: editForm.name.trim(),
        image: editForm.image.trim(),
        roomNumber: editForm.roomNumber.trim(),
        jobTitle: editForm.jobTitle.trim(),
        linkedin: editForm.linkedin.trim(),
        github: editForm.github.trim(),
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
      <TextInput
        key={field.id}
        label={field.name}
        value={value.toString()}
        onChangeText={(text) => setEditCustomFields(prev => ({ ...prev, [field.id]: text }))}
        mode="outlined"
        style={styles.input}
        multiline={field.type === 'text'}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        placeholder={field.description}
      />
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Profile not found</Text>
      </View>
    );
  }

  const displayData = isEditing ? editForm : profile;
  const displayCustomFields = isEditing ? editCustomFields : (profile.customFields || {});

  // Resolve user tags
  const userTagIds = profile.tags || [];
  const resolvedTags = userTagIds.map(tagId => {
    const found = tags.find(t => t.id === tagId);
    return found ? found.name : null;
  }).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header Section */}
        <Surface style={styles.headerSurface} elevation={1}>
          <View style={styles.avatarContainer}>
            {displayData.image ? (
              <Avatar.Image size={100} source={{ uri: displayData.image }} />
            ) : (
              <Avatar.Text size={100} label={getInitials(displayData.name || authUser?.email)} />
            )}
            
            {isEditing && (
              <IconButton
                icon="camera"
                mode="contained"
                size={24}
                style={styles.editAvatarButton}
                onPress={handlePickImage}
                loading={uploadingImage}
                disabled={uploadingImage}
              />
            )}
          </View>
          
          <Text variant="headlineSmall" style={styles.headerName}>{displayData.name || 'No Name'}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{profile.email}</Text>
          
          <View style={styles.chipContainer}>
            <Chip 
              mode="outlined" 
              style={[styles.chip, { borderColor: (profile.status === 'active' || !profile.status) ? theme.colors.success : theme.colors.warning }]}
              textStyle={{ color: (profile.status === 'active' || !profile.status) ? theme.colors.success : theme.colors.warning, textTransform: 'capitalize' }}
            >
              {profile.status || 'Active'}
            </Chip>
            {roles?.admin && <Chip mode="flat" style={styles.chip}>Admin</Chip>}
          </View>

          {!isEditing ? (
            <Button mode="contained" onPress={() => setIsEditing(true)} style={styles.editButton}>
              Edit Profile
            </Button>
          ) : (
            <View style={styles.editActions}>
              <Button mode="outlined" onPress={() => { setIsEditing(false); setEditForm({ name: profile.name || '', image: profile.image || '', roomNumber: profile.roomNumber || '', jobTitle: profile.jobTitle || '', linkedin: profile.linkedin || '', github: profile.github || '', tags: profile.tags || [] }); setEditCustomFields(profile.customFields || {}); }} style={styles.actionBtn}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleSave} loading={saving} style={styles.actionBtn}>
                Save
              </Button>
            </View>
          )}
        </Surface>

        {/* Profile Info Section */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Profile Info</Text>
          <Divider style={styles.divider} />
          
          {isEditing ? (
            <>
              <TextInput label="Full Name" value={editForm.name} onChangeText={t => setEditForm(prev => ({...prev, name: t}))} mode="outlined" style={styles.input} />
              <TextInput label="Room Number" value={editForm.roomNumber} onChangeText={t => setEditForm(prev => ({...prev, roomNumber: t}))} mode="outlined" style={styles.input} />
              <TextInput label="Job Title / Current Status" value={editForm.jobTitle} onChangeText={t => setEditForm(prev => ({...prev, jobTitle: t}))} mode="outlined" style={styles.input} />
              <TextInput label="LinkedIn URL" value={editForm.linkedin} onChangeText={t => setEditForm(prev => ({...prev, linkedin: t}))} mode="outlined" style={styles.input} autoCapitalize="none" keyboardType="url" />
              <TextInput label="GitHub URL" value={editForm.github} onChangeText={t => setEditForm(prev => ({...prev, github: t}))} mode="outlined" style={styles.input} autoCapitalize="none" keyboardType="url" />
              {customFields.map(renderCustomFieldInput)}
            </>
          ) : (
            <>
              <InfoRow label="Room Number" value={profile.roomNumber || 'N/A'} />
              <InfoRow label="Job Title / Current Status" value={profile.jobTitle || 'N/A'} />
              <InfoRow label="LinkedIn URL" value={profile.linkedin || 'N/A'} isLink={!!profile.linkedin} />
              <InfoRow label="GitHub URL" value={profile.github || 'N/A'} isLink={!!profile.github} />
              
              {customFields.map(field => {
                const val = displayCustomFields[field.id];
                const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
                return (
                  <InfoRow 
                    key={field.id} 
                    label={field.name} 
                    value={val || 'N/A'}
                    isLink={isUrl}
                  />
                );
              })}
            </>
          )}
        </Surface>

        {/* Tags Section */}
        {((isEditing && isSuperAdmin && tags.length > 0) || resolvedTags.length > 0) && (
          <Surface style={styles.sectionSurface} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Tags & Groups</Text>
            <Divider style={styles.divider} />
            <View style={styles.tagsContainer}>
              {isEditing && isSuperAdmin ? (
                tags.map(tag => {
                  const isSelected = (editForm.tags || []).includes(tag.id);
                  return (
                    <Chip
                      key={tag.id}
                      mode={isSelected ? "flat" : "outlined"}
                      onPress={() => handleTagToggle(tag.id)}
                      style={[styles.tagChip, isSelected && { backgroundColor: theme.colors.primaryContainer }]}
                      textStyle={isSelected && { color: theme.colors.onPrimaryContainer }}
                    >
                      {tag.name}
                    </Chip>
                  );
                })
              ) : (
                resolvedTags.map((tagName, i) => (
                  <Chip key={i} style={styles.tagChip}>{tagName}</Chip>
                ))
              )}
            </View>
          </Surface>
        )}

        {/* App Version & Updates Section */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>App Version & Updates</Text>
          <Divider style={styles.divider} />
          <InfoRow label="Current Version" value="1.1.1" />
          <Button
            icon="cloud-refresh"
            mode="outlined"
            onPress={() => checkForUpdate(true)}
            loading={isChecking}
            disabled={isChecking || isDownloading}
            style={[styles.actionBtnFull, { marginTop: 12 }]}
          >
            Check for Updates
          </Button>
        </Surface>

        {/* Account Actions Section */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Account Actions</Text>
          <Divider style={styles.divider} />
          
          {!showMigration ? (
            <Button icon="email-sync" mode="outlined" onPress={() => setShowMigration(true)} style={styles.actionBtnFull}>
              Migrate Account Email
            </Button>
          ) : (
            <View style={styles.migrationContainer}>
              <Text variant="bodyMedium" style={{ marginBottom: 12 }}>Enter your new email address. You will receive an email to verify the change.</Text>
              <TextInput
                label="New Email Address"
                value={newEmail}
                onChangeText={setNewEmail}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.editActions}>
                <Button mode="text" onPress={() => setShowMigration(false)} style={styles.actionBtn}>Cancel</Button>
                <Button mode="contained" onPress={handleMigrate} loading={migrating} style={styles.actionBtn}>Request</Button>
              </View>
            </View>
          )}
          
          <Button icon="logout" mode="contained-tonal" buttonColor={theme.colors.errorContainer} textColor={theme.colors.error} onPress={handleLogout} style={[styles.actionBtnFull, { marginTop: 16 }]}>
            Sign Out
          </Button>
        </Surface>
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        action={{ label: 'Dismiss', onPress: () => setSnackbar({ ...snackbar, visible: false }) }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

const InfoRow = ({ label, value, isLink }) => {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>{label}</Text>
      <Text variant="bodyLarge" style={{ color: isLink ? theme.colors.primary : theme.colors.onSurface }}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSurface: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -10,
    right: -10,
  },
  headerName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 20,
    gap: 8,
  },
  chip: {
    borderRadius: 16,
  },
  editButton: {
    width: '100%',
    borderRadius: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
  },
  actionBtnFull: {
    width: '100%',
    borderRadius: 8,
  },
  sectionSurface: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  divider: {
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 16,
  },
  migrationContainer: {
    marginTop: 8,
  },
});
