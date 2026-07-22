import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, Card, Button, IconButton, Searchbar, TextInput, Divider, FAB } from 'react-native-paper';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../services/adminApi';

const EMPTY_USER = {
  name: '',
  email: '',
  roomNumber: '',
  jobTitle: '',
  linkedin: '',
  github: '',
  image: ''
};

export default function ManageTeamMembersScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [formData, setFormData] = useState(EMPTY_USER);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = UsersService.subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_USER);
    setEditingEmail('__new__');
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      email: item.email || '',
      roomNumber: item.roomNumber || '',
      jobTitle: item.jobTitle || '',
      linkedin: item.linkedin || '',
      github: item.github || '',
      image: item.image || ''
    });
    setEditingEmail(item.email);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.email.trim()) {
      Alert.alert('Required', 'Email is required.');
      return;
    }
    setIsSaving(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const isNew = editingEmail === '__new__';
      await UsersService.updateUser(email, formData, isNew, editingEmail);
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save team member.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = (item) => {
    if (item.email === user?.email) {
      Alert.alert('Not allowed', 'You cannot archive yourself.');
      return;
    }
    Alert.alert('Archive Member', `Are you sure you want to archive ${item.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => UsersService.archiveUser(item.email) }
    ]);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsSaving(true);
      try {
        const folder = `users/${formData.email || 'new'}`;
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          setFormData(prev => ({ ...prev, image: data.secure_url }));
        } else {
          Alert.alert('Upload Failed', data.error || 'Failed to upload image');
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to upload');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ padding: 16 }}>
        <Searchbar
          placeholder="Search members..."
          onChangeText={setSearchQuery}
          value={searchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text>{item.name ? item.name.charAt(0) : '?'}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text variant="titleMedium">{item.name || 'Unnamed'}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{item.email}</Text>
                {item.jobTitle ? <Text variant="bodySmall">{item.jobTitle}</Text> : null}
                {item.isArchived ? <Text style={{ color: theme.colors.error, fontSize: 12 }}>Archived</Text> : null}
              </View>
              <View style={{ flexDirection: 'row' }}>
                <IconButton icon="pencil" onPress={() => openEditModal(item)} />
                <IconButton icon="archive-arrow-down" iconColor={theme.colors.error} onPress={() => handleArchive(item)} />
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No members found.</Text>}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={openAddModal}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
            <Text variant="titleLarge">{editingEmail === '__new__' ? 'Add Member' : 'Edit Member'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={t => setFormData({...formData, email: t})}
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              label="Name"
              value={formData.name}
              onChangeText={t => setFormData({...formData, name: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Room Number"
              value={formData.roomNumber}
              onChangeText={t => setFormData({...formData, roomNumber: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Job Title / Current Status"
              value={formData.jobTitle}
              onChangeText={t => setFormData({...formData, jobTitle: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="LinkedIn URL"
              value={formData.linkedin}
              onChangeText={t => setFormData({...formData, linkedin: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="GitHub URL"
              value={formData.github}
              onChangeText={t => setFormData({...formData, github: t})}
              style={styles.input}
              mode="outlined"
            />
            
            <Divider style={{ marginVertical: 16 }} />
            <Text variant="titleMedium">Profile Image</Text>
            {formData.image ? (
              <Image source={{ uri: formData.image }} style={{ width: 100, height: 100, borderRadius: 50, marginVertical: 12, alignSelf: 'center' }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickImage} loading={isSaving} disabled={isSaving}>
              Upload Image
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 16, borderRadius: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, elevation: 4 },
  input: { marginBottom: 12 }
});
