import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Alert, Modal, ScrollView, Image, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, Card, Button, IconButton, Searchbar, TextInput, Divider, FAB, Chip, Surface, ActivityIndicator, Checkbox } from 'react-native-paper';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { JoinRequestsService } from '../../services/joinRequests';
import { TagsService } from '../../services/tags';
import { useAuthStore } from '../../stores/authStore';
import { uploadFile, apiPost, fetchAdmins, syncUserPermissions, logAdminAction } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import * as ImagePicker from 'expo-image-picker';

export default function ManageTeamMembersScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  
  const [users, setUsers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [tags, setTags] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [admins, setAdmins] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    const unsubUsers = UsersService.subscribeToUsers(setUsers);
    const unsubRequests = JoinRequestsService.subscribeToPendingRequests(setJoinRequests);
    const unsubTags = TagsService.subscribeToTags(setTags);
    const unsubFields = CustomFieldsService.subscribeToCustomFields(setCustomFields);

    fetchAdmins().then(setAdmins).catch(console.error);
    setLoading(false);

    return () => {
      unsubUsers();
      unsubRequests();
      unsubTags();
      unsubFields();
    };
  }, []);

  const sections = useMemo(() => {
    // Merge users and admins (for orphaned admins)
    const activeUsers = users.filter(u => u.status === 'active' || !u.status);
    const mergedMembers = [...activeUsers];
    admins.forEach(admin => {
      if (!mergedMembers.find(u => u.email === admin.email)) {
        mergedMembers.push({ email: admin.email, name: 'Incomplete Profile', isOrphanedAdmin: true, tags: [] });
      }
    });
    
    // Also include archived users for the archived section
    const archivedMembers = users.filter(u => u.isArchived);

    // Filter by searchQuery
    const filterBySearch = (list) => list.filter(u => 
      (u.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const filteredMerged = filterBySearch(mergedMembers);
    const filteredArchived = filterBySearch(archivedMembers);

    const groups = [];
    
    tags.forEach(tag => {
      if (selectedTagFilter !== 'all' && tag.id !== selectedTagFilter) return;

      const membersInTag = filteredMerged.filter(m => (m.tags || []).includes(tag.id));
      
      if (membersInTag.length > 0 || selectedTagFilter === tag.id) {
        groups.push({ title: tag.name, data: membersInTag, tagId: tag.id });
      }
    });

    // Untagged Members
    const validTagIds = new Set(tags.map(t => t.id));
    const untaggedMembers = (selectedTagFilter === 'all' || selectedTagFilter === 'untagged') 
      ? filteredMerged.filter(m => {
          const validUserTags = (m.tags || []).filter(tid => validTagIds.has(tid));
          return validUserTags.length === 0;
        })
      : [];

    if (untaggedMembers.length > 0 || selectedTagFilter === 'untagged') {
      groups.push({ title: 'Untagged Members', data: untaggedMembers });
    }
    
    // Archived Members
    if (selectedTagFilter === 'all' || selectedTagFilter === 'archived') {
      if (filteredArchived.length > 0 || selectedTagFilter === 'archived') {
        groups.push({ title: 'Archived Members', data: filteredArchived });
      }
    }

    return groups;
  }, [users, tags, admins, searchQuery, selectedTagFilter]);

  const handleApproveRequest = async (req) => {
    try {
      await apiPost('/api/admin/requests/approve', { 
        requestId: req.id, 
        email: req.email, 
        name: req.name, 
        tags: [], 
        customFields: req.customFields || {} 
      });
      Alert.alert('Success', 'Request approved!');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await JoinRequestsService.rejectRequest(reqId);
      Alert.alert('Success', 'Request rejected.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setIsEditing(false);
    setFormData({ email: '', tags: [], customFields: {} });
    setSelectedTags([]);
    setModalVisible(true);
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setIsEditing(true);
    setFormData({ ...u, customFields: u.customFields || {} });
    setSelectedTags(u.tags || []);
    setModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!formData.email) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    
    setSaving(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const finalTags = expandTagIds(selectedTags, tags);
      
      if (!isEditing) {
        const res = await apiPost('/api/admin/users/create', { 
          email, 
          tags: finalTags, 
          customFields: formData.customFields 
        });
        if (!res.ok) {
          throw new Error(res.data?.error || 'Failed to create user');
        }
      } else {
        const payload = {
          ...formData,
          tags: finalTags,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', email), payload, { merge: true });
      }
      
      // Sync permissions based on tags
      const currentAdmins = admins.length > 0 ? admins : await fetchAdmins();
      await syncUserPermissions(email, finalTags, tags, currentAdmins);
      
      // Refresh admins list
      fetchAdmins().then(setAdmins).catch(console.error);
      
      setModalVisible(false);
      Alert.alert('Success', `User ${isEditing ? 'updated' : 'added'} successfully.`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveUser = async (email) => {
    Alert.alert(
      'Archive User',
      'Are you sure you want to archive this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Archive', 
          style: 'destructive',
          onPress: async () => {
            try {
              await UsersService.archiveUser(email);
              Alert.alert('Success', 'User archived.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const handleRestoreUser = async (email) => {
    try {
      await setDoc(doc(db, 'users', email), { isActive: true, isArchived: false }, { merge: true });
      Alert.alert('Success', 'User restored.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteUser = async (email) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to permanently delete this user? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', email));
              await syncUserPermissions(email, [], tags, admins);
              Alert.alert('Success', 'User permanently deleted.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev => {
      let newTags = [...prev];
      if (newTags.includes(tagId)) {
        newTags = newTags.filter(id => id !== tagId);
      } else {
        newTags.push(tagId);
        // Auto-expand grants for the newly added tag
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
          const granted = getGrantedTagIds(tag, tags);
          granted.forEach(gid => {
            if (!newTags.includes(gid)) newTags.push(gid);
          });
        }
      }
      return newTags;
    });
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setSaving(true);
      try {
        const folder = `users/${formData.email.toLowerCase()}`;
        const { ok, data } = await uploadFile(asset.uri, folder);
        if (ok && data?.secure_url) {
          setFormData({ ...formData, image: data.secure_url });
        } else {
          Alert.alert('Upload Error', data?.error || 'Failed to upload image');
        }
      } catch (err) {
        Alert.alert('Upload Error', err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const renderJoinRequests = () => {
    if (joinRequests.length === 0) return null;
    return (
      <View style={styles.requestsContainer}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Pending Join Requests</Text>
        {joinRequests.map(req => (
          <Card key={req.id} style={[styles.requestCard, { borderColor: theme.colors.warning }]}>
            <Card.Content>
              <Text variant="titleMedium">{req.name || 'No Name'}</Text>
              <Text variant="bodyMedium">{req.email}</Text>
              {req.customFields && Object.entries(req.customFields).map(([fieldId, value]) => {
                const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
                return (
                  <Text key={fieldId} variant="bodySmall" style={{ marginTop: 2 }}>{fieldName}: {value}</Text>
                );
              })}
            </Card.Content>
            <Card.Actions>
              <Button mode="outlined" textColor={theme.colors.error} onPress={() => handleRejectRequest(req.id)}>Reject</Button>
              <Button mode="contained" buttonColor={theme.colors.success} onPress={() => handleApproveRequest(req)}>Approve</Button>
            </Card.Actions>
          </Card>
        ))}
      </View>
    );
  };

  const renderMember = ({ item }) => {
    return (
      <Card style={styles.memberCard} onPress={() => !item.isArchived && openEditModal(item)}>
        <Card.Title
          title={item.name || item.email}
          subtitle={item.email}
          left={(props) => item.image ? <Image source={{ uri: item.image }} style={styles.avatar} /> : <IconButton {...props} icon="account" />}
          right={(props) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {item.isArchived ? (
                <>
                  <Chip style={{ marginRight: 8, backgroundColor: theme.colors.errorContainer }} textStyle={{ color: theme.colors.error }}>Archived</Chip>
                  <IconButton {...props} icon="restore" iconColor={theme.colors.success} onPress={() => handleRestoreUser(item.email)} />
                  <IconButton {...props} icon="delete-forever" iconColor={theme.colors.error} onPress={() => handleDeleteUser(item.email)} />
                </>
              ) : (
                <>
                  <Chip style={{ marginRight: 8, backgroundColor: theme.colors.surfaceVariant }}>
                    {item.status === 'active' || !item.status ? 'Active' : item.status}
                  </Chip>
                  <IconButton {...props} icon="delete-outline" iconColor={theme.colors.error} onPress={() => handleArchiveUser(item.email)} />
                </>
              )}
            </View>
          )}
        />
        <Card.Content>
          {item.isOrphanedAdmin && (
            <Text style={{ color: theme.colors.warning, fontSize: 12, marginBottom: 8 }}>
              This admin doesn't have a full profile yet. Click Edit to create one.
            </Text>
          )}
          <View style={styles.tagsRow}>
            {item.tags?.map(tid => {
              const tagObj = tags.find(t => t.id === tid);
              return tagObj ? <Chip key={tid} style={styles.tagChip} textStyle={styles.tagText}>{tagObj.name}</Chip> : null;
            })}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Searchbar
        placeholder="Search members..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />
      
      <View style={{ marginBottom: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <Chip 
            selected={selectedTagFilter === 'all'} 
            onPress={() => setSelectedTagFilter('all')}
            style={{ backgroundColor: selectedTagFilter === 'all' ? theme.colors.primary : theme.colors.surfaceVariant }}
            textStyle={{ color: selectedTagFilter === 'all' ? theme.colors.onPrimary : theme.colors.onSurface }}
          >
            All Members
          </Chip>
          <Chip 
            selected={selectedTagFilter === 'untagged'} 
            onPress={() => setSelectedTagFilter('untagged')}
            style={{ backgroundColor: selectedTagFilter === 'untagged' ? theme.colors.primary : theme.colors.surfaceVariant }}
            textStyle={{ color: selectedTagFilter === 'untagged' ? theme.colors.onPrimary : theme.colors.onSurface }}
          >
            Untagged
          </Chip>
          <Chip 
            selected={selectedTagFilter === 'archived'} 
            onPress={() => setSelectedTagFilter('archived')}
            style={{ backgroundColor: selectedTagFilter === 'archived' ? theme.colors.primary : theme.colors.surfaceVariant }}
            textStyle={{ color: selectedTagFilter === 'archived' ? theme.colors.onPrimary : theme.colors.onSurface }}
          >
            Archived
          </Chip>
          {tags.filter(t => t.isGroup !== false).map(t => (
            <Chip 
              key={t.id}
              selected={selectedTagFilter === t.id} 
              onPress={() => setSelectedTagFilter(t.id)}
              style={{ backgroundColor: selectedTagFilter === t.id ? theme.colors.primary : theme.colors.surfaceVariant }}
              textStyle={{ color: selectedTagFilter === t.id ? theme.colors.onPrimary : theme.colors.onSurface }}
            >
              {t.name}
            </Chip>
          ))}
        </ScrollView>
      </View>
      
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.email}
        renderItem={renderMember}
        renderSectionHeader={({ section: { title } }) => (
          <Surface style={styles.sectionHeaderSurface} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionHeader}>{title}</Text>
          </Surface>
        )}
        ListHeaderComponent={renderJoinRequests}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openAddModal}
      />

      {/* Edit/Add Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge">{isEditing ? 'Edit Member' : 'Add New Member'}</Text>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
          </View>
          
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              style={styles.input}
              disabled={isEditing}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Divider style={styles.divider} />
            <Text variant="titleMedium" style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {tags.map(tag => (
                <TouchableOpacity key={tag.id} style={styles.tagCheckboxRow} onPress={() => toggleTag(tag.id)}>
                  <Checkbox
                    status={selectedTags.includes(tag.id) ? 'checked' : 'unchecked'}
                    onPress={() => toggleTag(tag.id)}
                  />
                  <Text>{tag.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {customFields.length > 0 && !isEditing && (
              <>
                {customFields.map(field => (
                  <TextInput
                    key={field.id}
                    label={field.name}
                    value={formData.customFields?.[field.id] || ''}
                    onChangeText={(text) => setFormData({
                      ...formData,
                      customFields: { ...formData.customFields, [field.id]: text }
                    })}
                    style={styles.input}
                  />
                ))}
              </>
            )}

            <Button
              mode="contained"
              onPress={handleSaveUser}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            >
              Save Member
            </Button>
            <View style={{height: 40}} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1017', // Match theme background
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#161f2b'
  },
  listContent: {
    paddingBottom: 80,
  },
  sectionHeaderSurface: {
    backgroundColor: '#0b1017',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#2F81F7', // primary
    fontWeight: 'bold',
  },
  requestsContainer: {
    padding: 16,
    marginBottom: 8,
  },
  requestCard: {
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: '#161f2b'
  },
  memberCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#161f2b'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagChip: {
    marginRight: 6,
    marginBottom: 6,
    height: 24,
    backgroundColor: '#111827' // surface
  },
  tagText: {
    fontSize: 10,
    marginVertical: 0,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2F81F7',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalScroll: {
    padding: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#111827',
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  tagsContainer: {
    marginBottom: 16,
  },
  tagCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  saveButton: {
    marginTop: 24,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#111827'
  }
});
