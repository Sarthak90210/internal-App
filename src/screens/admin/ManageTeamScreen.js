import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { List, FAB, useTheme, ActivityIndicator, Text, Button, TextInput, Switch, IconButton, Divider, Searchbar, Checkbox } from 'react-native-paper';
import { TeamService } from '../../services/team';
import { useAuthStore } from '../../stores/authStore';
import { useTagStore } from '../../stores/tagStore';

const EMPTY_MEMBER = {
  userId: '',
  role: '',
  category: 'leaders',
  order: 0,
  isActive: true,
  year: ''
};

export default function ManageTeamScreen() {
  const theme = useTheme();
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
      Alert.alert('No Year', 'Please create or select a team year first.');
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
    Alert.alert('Confirm Delete', `Are you sure you want to remove this member?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => TeamService.deleteTeamMember(item) }
    ]);
  };

  const handleSave = async () => {
    if (!formData.userId) {
      Alert.alert('Required', 'A User ID is required.');
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
      Alert.alert('Error', 'Failed to save team member');
    } finally {
      setIsSaving(false);
    }
  };

  const getUserDetails = (userId) => {
    const found = users.find(u => u.id === userId);
    return found ? (found.name || found.email) : userId;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.yearSelector, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Select Year:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {years.map(y => (
            <TouchableOpacity 
              key={y.id} 
              onPress={() => setSelectedYear(y.year)}
              style={[styles.yearChip, { backgroundColor: selectedYear === y.year ? theme.colors.primary : theme.colors.surfaceVariant }]}
            >
              <Text style={{ color: selectedYear === y.year ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                {y.year} {y.isCurrent ? '⭐' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={currentYearMembers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => {
            return (
              <List.Item
                title={getUserDetails(item.userId)}
                description={`${item.role} (${item.category})`}
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8 }}
                left={props => <List.Icon {...props} icon="account-badge" color={item.isActive ? theme.colors.primary : theme.colors.error} />}
                right={props => (
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="pencil" iconColor={theme.colors.primary} onPress={() => openEditModal(item)} />
                    <IconButton icon="delete" iconColor={theme.colors.error} onPress={() => handleDelete(item)} />
                  </View>
                )}
              />
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No members found for {selectedYear}.
            </Text>
          }
        />
      )}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={openAddModal}
      />

      {/* Main Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
            <Text variant="titleLarge">{editingId ? 'Edit Member' : 'Add Member'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="User ID"
              value={formData.userId}
              onChangeText={t => setFormData({...formData, userId: t})}
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label="Role (e.g. CAPTAIN)"
              value={formData.role}
              onChangeText={t => setFormData({...formData, role: t})}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Category (leaders / technical / essential)"
              value={formData.category}
              onChangeText={t => setFormData({...formData, category: t})}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Order"
              value={String(formData.order)}
              onChangeText={t => setFormData({...formData, order: t})}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />
            
            <View style={styles.switchRow}>
              <Text>Active</Text>
              <Switch value={formData.isActive} onValueChange={v => setFormData({...formData, isActive: v})} />
            </View>
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  yearSelector: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 16,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    elevation: 4
  },
  input: {
    marginBottom: 12
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  }
});
