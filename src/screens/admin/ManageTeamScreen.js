import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { Award, Briefcase, Wrench, Eye, EyeOff } from '../../lib/lucideIcons';
import { TeamService } from '../../services/team';
import { useAuthStore } from '../../stores/authStore';
import { 
  AppChip, 
  AppListItem, 
  AppFAB, 
  AppModal, 
  AppInput, 
  AppButton, 
  AppBadge, 
  AppSkeleton, 
  AppEmptyState 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const EMPTY_MEMBER = {
  userId: '',
  role: '',
  category: 'leaders',
  order: 0,
  isActive: true,
  year: ''
};

export default function ManageTeamScreen() {
  const { user } = useAuthStore();

  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_MEMBER);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubYears = TeamService.subscribeToTeamYears((data) => {
      setYears(data);
      if (data.length > 0 && !selectedYear) {
        setSelectedYear(data[0].year);
      }
    });

    const unsubMembers = TeamService.subscribeToTeamMembers((data) => {
      setMembers(data);
      setLoading(false);
    });

    TeamService.getUsers().then(setUsers);

    return () => {
      unsubYears();
      unsubMembers();
    };
  }, [selectedYear]);

  const currentYearMembers = members.filter(m => m.year === selectedYear);

  const openAddModal = () => {
    if (!selectedYear) {
      Alert.alert('No Year Selected', 'Please create or select a team year first.');
      return;
    }
    setFormData({ ...EMPTY_MEMBER, year: selectedYear });
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      userId: item.userId || '',
      role: item.role || '',
      category: item.category || 'leaders',
      order: item.order || 0,
      isActive: item.isActive !== false,
      year: item.year || selectedYear
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Remove Team Member', `Are you sure you want to permanently remove this member from the ${item.year} roster?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => TeamService.deleteTeamMember(item) }
    ]);
  };

  const handleSave = async () => {
    if (!formData.userId) {
      Alert.alert('Required Field', 'A User ID / Account Email is required to assign this role.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        await TeamService.updateTeamMember(editingId, dataToSave, user?.email);
      } else {
        await TeamService.addTeamMember(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save team member details');
    } finally {
      setIsSaving(false);
    }
  };

  const getUserDetails = (userId) => {
    const found = users.find(u => u.id === userId || u.email === userId);
    return found ? (found.name || found.email) : userId;
  };

  const getCategoryIcon = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat === 'leaders') return <Award size={18} color="#A855F7" />;
    if (cat === 'technical') return <Wrench size={18} color="#38BDF8" />;
    return <Briefcase size={18} color="#10B981" />;
  };

  const getCategoryBadgeVariant = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat === 'leaders') return 'primary';
    if (cat === 'technical') return 'secondary';
    return 'success';
  };

  return (
    <View style={styles.container}>
      <View style={styles.yearHeader}>
        <Text style={styles.yearHeaderLabel}>Roster Year</Text>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
          {years.map(y => (
            <AppChip 
              key={y.id || y.year} 
              label={`${y.year}${y.isCurrent ? ' ★' : ''}`}
              selected={selectedYear === y.year}
              onPress={() => setSelectedYear(y.year)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={76} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={76} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={76} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={currentYearMembers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const userName = getUserDetails(item.userId);
            const badgeVariant = !item.isActive ? 'danger' : getCategoryBadgeVariant(item.category);
            const badgeLabel = !item.isActive ? 'Inactive' : (item.category || 'Member').toUpperCase();

            return (
              <AppListItem
                title={userName}
                description={`${item.role || 'Team Member'} • Order #${item.order}`}
                leftIcon={
                  <View style={[styles.iconBox, { backgroundColor: item.category === 'leaders' ? '#A855F715' : '#38BDF815' }]}>
                    {getCategoryIcon(item.category)}
                  </View>
                }
                rightElement={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant={badgeVariant}>{badgeLabel}</AppBadge>
                  </View>
                }
                onPress={() => openEditModal(item)}
                onDelete={() => handleDelete(item)}
              />
            );
          }}
          ListEmptyComponent={
            <AppEmptyState
              title={`No Roster Found (${selectedYear || 'Select Year'})`}
              description="There are no team members assigned to this academic year yet."
              actionLabel="Add Team Member"
              onAction={openAddModal}
            />
          }
        />
      )}

      <AppFAB
        label="Add Member"
        onPress={openAddModal}
      />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Team Assignment' : `Add to ${selectedYear || ''} Roster`}
        footer={
          <View style={styles.modalFooter}>
            <AppButton variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Assignment
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="User ID / Account Email"
          value={formData.userId}
          onChangeText={t => setFormData({...formData, userId: t})}
          placeholder="e.g. member@rotorfpv.com or User ID"
          autoFocus={!editingId}
        />
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Assigned Role / Title"
            value={formData.role}
            onChangeText={t => setFormData({...formData, role: t})}
            placeholder="e.g. CAPTAIN, DRONE PILOT, HARDWARE LEAD"
          />
        </View>
        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Roster Category"
            value={formData.category}
            onChangeText={t => setFormData({...formData, category: t})}
            placeholder="leaders / technical / essential"
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
              <Text style={styles.switchTitle}>Active Roster Status</Text>
            </View>
            <Text style={styles.switchSub}>When disabled, this member is hidden from the public team page.</Text>
          </View>
          <Switch 
            value={formData.isActive} 
            onValueChange={v => setFormData({...formData, isActive: v})}
            trackColor={{ false: appColors.border, true: appColors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  yearHeader: {
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    paddingVertical: 14,
    paddingHorizontal: appSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearHeaderLabel: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    marginRight: 12,
  },
  yearScroll: {
    alignItems: 'center',
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
});

