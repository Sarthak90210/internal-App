import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, Image } from 'react-native';
import { List, FAB, useTheme, ActivityIndicator, Text, Button, TextInput, Switch, IconButton, Divider, Searchbar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { AchievementsService } from '../../services/achievements';
import { useAuthStore } from '../../stores/authStore';
import { uploadFile } from '../../services/adminApi';

const EMPTY_ACHIEVEMENT = {
  title: '',
  year: '',
  description: '',
  images: [],
  order: 0
};

export default function ManageAchievementsScreen() {
  const theme = useTheme();
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
    return items.filter(t => t.title?.toLowerCase().includes(lowerQ));
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
    Alert.alert('Confirm Delete', `Are you sure you want to delete ${item.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => AchievementsService.deleteAchievement(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.title) {
      Alert.alert('Required', 'Please enter a title first.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsSaving(true);
      try {
        const safeName = formData.title.trim().replace(/\s+/g, '-');
        const folder = `achievements/${safeName}`;
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          setFormData(prev => ({ ...prev, images: [data.secure_url] }));
        } else {
          Alert.alert('Upload Failed', data.error || 'Failed to upload image');
        }
      } catch (err) {
        Alert.alert('Error', err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.images || formData.images.length === 0) {
      Alert.alert('Required', 'Title and Image are required.');
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
      Alert.alert('Error', 'Failed to save achievement');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ padding: 16 }}>
        <Searchbar
          placeholder="Search achievements..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          elevation={1}
        />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <List.Item
              title={item.title || 'Untitled'}
              description={`${item.year} | Order: ${item.order}`}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8 }}
              left={props => (
                 item.images && item.images.length > 0 ? 
                  <Image source={{ uri: item.images[0] }} style={{ width: 50, height: 50, borderRadius: 25, margin: 8 }} />
                  : <List.Icon {...props} icon="trophy" color={theme.colors.primary} />
              )}
              right={props => (
                <View style={{ flexDirection: 'row' }}>
                  <IconButton icon="pencil" iconColor={theme.colors.primary} onPress={() => openEditModal(item)} />
                  <IconButton icon="delete" iconColor={theme.colors.error} onPress={() => handleDelete(item)} />
                </View>
              )}
            />
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No achievements found.
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

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
            <Text variant="titleLarge">{editingId ? 'Edit Achievement' : 'Add Achievement'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="Title"
              value={formData.title}
              onChangeText={t => setFormData({...formData, title: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Year (e.g. 2024)"
              value={formData.year}
              onChangeText={t => setFormData({...formData, year: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Description"
              value={formData.description}
              onChangeText={t => setFormData({...formData, description: t})}
              style={styles.input}
              mode="outlined"
              multiline
            />
            <TextInput
              label="Order"
              value={String(formData.order)}
              onChangeText={t => setFormData({...formData, order: t})}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />
            
            <Divider style={{ marginVertical: 16 }} />
            
            <Text variant="titleMedium">Image</Text>
            {formData.images && formData.images.length > 0 ? (
              <Image source={{ uri: formData.images[0] }} style={{ width: '100%', height: 200, borderRadius: 8, marginVertical: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickImage} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              {formData.images && formData.images.length > 0 ? 'Change Image' : 'Upload Image'}
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
