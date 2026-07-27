import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Alert, ScrollView, Image, SectionList, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { User, UserCheck, UserX, Tag, Archive, Trash2, RotateCcw, CheckSquare, Square, AlertTriangle } from '../../lib/lucideIcons';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { JoinRequestsService } from '../../services/joinRequests';
import { TagsService } from '../../services/tags';
import { apiPost, fetchAdmins, syncUserPermissions } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import { 
  AppSearchBar, 
  AppChip, 
  AppCard, 
  AppButton, 
  AppBadge, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppSkeleton, 
  AppEmptyState,
  AppSection
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function ManageTeamMembersScreen() {
  
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
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    const unsubUsers = UsersService.subscribeToUsers(setUsers);
    const unsubRequests = JoinRequestsService.subscribeToPendingRequests(setJoinRequests);
    const unsubTags = TagsService.subscribeToTags(setTags);
    const unsubFields = CustomFieldsService.subscribeToCustomFields(setCustomFields);

    fetchAdmins().then(setAdmins).catch((err) => {
      console.warn('[ManageTeamMembersScreen] Could not fetch admins list (local backend may be offline):', err.message);
    });
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
      Alert.alert('Success', 'Member application approved and account created!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to approve application.');
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await JoinRequestsService.rejectRequest(reqId);
      Alert.alert('Success', 'Application rejected.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject application.');
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ email: '', tags: [], customFields: {} });
    setSelectedTags([]);
    setModalVisible(true);
  };

  const openEditModal = (u) => {
    setIsEditing(true);
    setFormData({ ...u, customFields: u.customFields || {} });
    setSelectedTags(u.tags || []);
    setModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!formData.email) {
      Alert.alert('Required Field', 'Email address is required to register or modify a team member.');
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
          throw new Error(res.data?.error || 'Failed to create user account.');
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
      fetchAdmins().then(setAdmins).catch((err) => {
        console.warn('[ManageTeamMembersScreen] Could not fetch admins list (local backend may be offline):', err.message);
      });
      
      setModalVisible(false);
      Alert.alert('Success', `Team member ${isEditing ? 'updated' : 'registered'} successfully.`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save member profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveUser = async (email) => {
    Alert.alert(
      'Archive Member',
      'Are you sure you want to archive this user? They will lose active platform access.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Archive', 
          style: 'destructive',
          onPress: async () => {
            try {
              await UsersService.archiveUser(email);
              Alert.alert('Success', 'Member archived.');
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
      Alert.alert('Success', 'Member account restored to active status.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteUser = async (email) => {
    Alert.alert(
      'Permanent Deletion',
      'Are you sure you want to permanently delete this account? All associated user records and permissions will be wiped.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
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

  const renderJoinRequests = () => {
    if (joinRequests.length === 0) return null;
    return (
      <View style={styles.requestsContainer}>
        <View style={styles.reqHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: '#F59E0B15' }]}>
            <AlertTriangle size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reqTitle}>Pending Join Applications ({joinRequests.length})</Text>
            <Text style={styles.reqSub}>Review applicants wishing to join the engineering team repository</Text>
          </View>
        </View>
        {joinRequests.map(req => (
          <AppCard key={req.id} variant="elevated" style={styles.reqCard}>
            <View style={styles.reqCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqName}>{req.name || 'Anonymous Applicant'}</Text>
                <Text style={styles.reqEmail}>{req.email}</Text>
              </View>
              <AppBadge variant="warning">AWAITING APPROVAL</AppBadge>
            </View>

            {req.customFields && Object.keys(req.customFields).length > 0 ? (
              <View style={styles.reqFieldsBox}>
                {Object.entries(req.customFields).map(([fieldId, value]) => {
                  const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
                  return (
                    <View key={fieldId} style={styles.reqFieldItem}>
                      <Text style={styles.reqFieldLabel}>{fieldName}:</Text>
                      <Text style={styles.reqFieldValue}>{value}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.reqActions}>
              <AppButton 
                variant="ghost" 
                size="sm" 
                onPress={() => handleRejectRequest(req.id)}
                style={{ flex: 1, marginRight: 8 }}
                icon={<UserX size={14} color="#EF4444" />}
              >
                Reject
              </AppButton>
              <AppButton 
                variant="primary" 
                size="sm" 
                onPress={() => handleApproveRequest(req)}
                style={{ flex: 1 }}
                icon={<UserCheck size={14} color={appColors.background} />}
              >
                Approve & Register
              </AppButton>
            </View>
          </AppCard>
        ))}
      </View>
    );
  };

  const renderMember = ({ item }) => {
    return (
      <AppCard 
        variant="surface" 
        style={styles.memberCard}
        onPress={() => !item.isArchived && openEditModal(item)}
      >
        <View style={styles.memberHeaderRow}>
          <View style={styles.memberAvatarBox}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.avatarImg} />
            ) : (
              <User size={20} color={appColors.textSecondary} />
            )}
          </View>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.memberName}>{item.name || item.email}</Text>
              {item.isOrphanedAdmin ? (
                <AppBadge variant="warning">ORPHANED ADMIN</AppBadge>
              ) : null}
            </View>
            <Text style={styles.memberEmail}>{item.email}</Text>
          </View>

          <View style={styles.memberActions}>
            {item.isArchived ? (
              <>
                <AppBadge variant="danger">ARCHIVED</AppBadge>
                <Pressable onPress={() => handleRestoreUser(item.email)} style={styles.iconBtn}>
                  <RotateCcw size={16} color="#10B981" />
                </Pressable>
                <Pressable onPress={() => handleDeleteUser(item.email)} style={styles.iconBtnDanger}>
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              </>
            ) : (
              <>
                <AppBadge variant="success">ACTIVE</AppBadge>
                <Pressable onPress={() => handleArchiveUser(item.email)} style={styles.iconBtn}>
                  <Archive size={16} color={appColors.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {item.tags && item.tags.length > 0 ? (
          <View style={styles.memberTagsRow}>
            {item.tags.map(tid => {
              const tagObj = tags.find(t => t.id === tid);
              if (!tagObj) return null;
              return (
                <View key={tid} style={styles.tagBadge}>
                  <Tag size={10} color={appColors.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.tagBadgeText}>{tagObj.name}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </AppCard>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <AppSearchBar
          placeholder="Search team members by name or email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterRow}>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <AppChip 
              selected={selectedTagFilter === 'all'}
              onPress={() => setSelectedTagFilter('all')}
            >
              All Members
            </AppChip>
            <AppChip 
              selected={selectedTagFilter === 'untagged'}
              onPress={() => setSelectedTagFilter('untagged')}
            >
              Untagged
            </AppChip>
            <AppChip 
              selected={selectedTagFilter === 'archived'}
              onPress={() => setSelectedTagFilter('archived')}
            >
              Archived
            </AppChip>
            {tags.filter(t => t.isGroup !== false).map(t => (
              <AppChip 
                key={t.id}
                selected={selectedTagFilter === t.id}
                onPress={() => setSelectedTagFilter(t.id)}
              >
                {t.name}
              </AppChip>
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={100} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={100} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={100} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.email}
          renderItem={renderMember}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleText}>{title}</Text>
              <Text style={styles.sectionCountText}>({data.length})</Text>
            </View>
          )}
          ListHeaderComponent={renderJoinRequests}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <AppEmptyState
              title="No Team Members Found"
              description={searchQuery ? "No members match your search criteria." : "No team members are listed under this filter group."}
              actionLabel={searchQuery ? undefined : "Add New Member"}
              onAction={searchQuery ? undefined : openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="Add Member"
        onPress={openAddModal}
      />

      {/* Add / Edit Member Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={isEditing ? 'Modify Member Permissions' : 'Register New Team Member'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSaveUser} style={{ flex: 1 }} loading={saving}>
              Save Member
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Account Email Address"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="member@teamrotorfpv.com"
          disabled={isEditing}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <AppSection title="Role & Division Tags (RBAC Permissions)" style={{ marginTop: appSpacing.xl }}>
          <Text style={styles.tagSectionDesc}>
            Assigning a division tag automatically grants associated sub-division permissions across the application repository.
          </Text>
          <View style={styles.tagsGrid}>
            {tags.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <Pressable 
                  key={tag.id} 
                  style={[styles.tagSelectCard, isSelected && styles.tagSelectCardActive]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isSelected ? <CheckSquare size={16} color="#8B5CF6" style={{ marginRight: 8 }} /> : <Square size={16} color={appColors.textMuted} style={{ marginRight: 8 }} />}
                    <Text style={[styles.tagSelectName, isSelected && { color: '#FFFFFF' }]}>{tag.name}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </AppSection>

        {customFields.length > 0 && !isEditing ? (
          <AppSection title="Custom Application Fields" style={{ marginTop: appSpacing.xl }}>
            {customFields.map(field => (
              <View key={field.id} style={{ marginBottom: 14 }}>
                <AppInput
                  label={field.name}
                  value={formData.customFields?.[field.id] || ''}
                  onChangeText={(text) => setFormData({
                    ...formData,
                    customFields: { ...formData.customFields, [field.id]: text }
                  })}
                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                />
              </View>
            ))}
          </AppSection>
        ) : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  headerArea: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  filterRow: {
    marginTop: 12,
  },
  filterScroll: {
    alignItems: 'center',
    gap: 8,
  },
  loadingWrap: {
    padding: appSpacing.xl,
  },
  listContent: {
    padding: appSpacing.xl,
    paddingBottom: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitleText: {
    ...appTypography.bodyBold,
    color: appColors.accent,
    fontSize: 15,
  },
  sectionCountText: {
    ...appTypography.body,
    color: appColors.textMuted,
    marginLeft: 6,
  },
  requestsContainer: {
    marginBottom: 20,
    backgroundColor: `${appColors.elevatedSurface}60`,
    padding: appSpacing.lg,
    borderRadius: appRadius.lg,
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: appRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reqTitle: {
    ...appTypography.bodyBold,
    color: '#F59E0B',
  },
  reqSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  reqCard: {
    padding: appSpacing.md,
    marginBottom: 12,
    borderColor: '#F59E0B30',
    borderWidth: 1,
  },
  reqCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reqName: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  reqEmail: {
    ...appTypography.caption,
    color: appColors.textSecondary,
  },
  reqFieldsBox: {
    backgroundColor: `${appColors.background}80`,
    padding: 10,
    borderRadius: appRadius.sm,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  reqFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  reqFieldLabel: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    marginRight: 6,
  },
  reqFieldValue: {
    ...appTypography.caption,
    color: appColors.textPrimary,
  },
  reqActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCard: {
    padding: appSpacing.md,
    marginBottom: 10,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: appRadius.full,
    backgroundColor: appColors.elevatedSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  memberName: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  memberEmail: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: appRadius.sm,
    backgroundColor: appColors.elevatedSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: appColors.border,
  },
  iconBtnDanger: {
    width: 32,
    height: 32,
    borderRadius: appRadius.sm,
    backgroundColor: '#EF444415',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  memberTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: `${appColors.border}50`,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${appColors.accent}10`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: appRadius.sm,
    borderWidth: 1,
    borderColor: `${appColors.accent}25`,
  },
  tagBadgeText: {
    ...appTypography.captionBold,
    color: appColors.accent,
    fontSize: 11,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagSectionDesc: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  tagsGrid: {
    gap: 8,
  },
  tagSelectCard: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: appRadius.md,
  },
  tagSelectCardActive: {
    backgroundColor: `${appColors.accent}15`,
    borderColor: appColors.accent,
  },
  tagSelectName: {
    ...appTypography.body,
    color: appColors.textPrimary,
  },
});

