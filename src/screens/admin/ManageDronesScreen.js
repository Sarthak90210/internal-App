import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, Image } from 'react-native';
import { List, FAB, useTheme, ActivityIndicator, Text, Button, TextInput, Switch, IconButton, Divider } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { DronesService } from '../../services/drones';
import { useAuthStore } from '../../stores/authStore';
import { uploadFile } from '../../services/adminApi';

const EMPTY_DRONE = {
  name: '',
  description: '',
  longDescription: '',
  image: '',
  modelUrl: '',
  modelPath: '',
  modelName: '',
  order: 0,
  isActive: true,
  components: []
};

export default function ManageDronesScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_DRONE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = DronesService.subscribeToDrones((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_DRONE);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      description: item.description || '',
      longDescription: item.longDescription || '',
      image: item.image || '',
      modelUrl: item.modelUrl || '',
      modelPath: item.modelPath || '',
      modelName: item.modelName || '',
      order: item.order || 0,
      isActive: item.isActive !== false,
      components: item.components || []
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => DronesService.deleteDrone(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.name) {
      Alert.alert('Required', 'Please enter a drone name first.');
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
        const safeName = formData.name.trim().replace(/\s+/g, '-');
        const folder = `drones/${safeName}`;
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          setFormData(prev => ({ ...prev, image: data.secure_url }));
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
    if (!formData.name || !formData.image) {
      Alert.alert('Required', 'Name and Image are required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await DronesService.updateDrone(editingId, oldItem, dataToSave, user?.email);
      } else {
        await DronesService.addDrone(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save drone');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <List.Item
              title={item.name || 'Unnamed Drone'}
              description={`Order: ${item.order}`}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8 }}
              left={props => (
                 item.image ? 
                  <Image source={{ uri: item.image }} style={{ width: 50, height: 50, borderRadius: 25, margin: 8 }} />
                  : <List.Icon {...props} icon="quadcopter" color={theme.colors.primary} />
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
              No drones found.
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
            <Text variant="titleLarge">{editingId ? 'Edit Drone' : 'Add Drone'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="Name"
              value={formData.name}
              onChangeText={t => setFormData({...formData, name: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Description (Short)"
              value={formData.description}
              onChangeText={t => setFormData({...formData, description: t})}
              style={styles.input}
              mode="outlined"
              multiline
            />
            <TextInput
              label="Detailed Description"
              value={formData.longDescription}
              onChangeText={t => setFormData({...formData, longDescription: t})}
              style={styles.input}
              mode="outlined"
              multiline
            />
            <TextInput
              label="Model URL"
              value={formData.modelUrl}
              onChangeText={t => setFormData({...formData, modelUrl: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Model Name"
              value={formData.modelName}
              onChangeText={t => setFormData({...formData, modelName: t})}
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
              <Text>Active (visible on website)</Text>
              <Switch value={formData.isActive} onValueChange={v => setFormData({...formData, isActive: v})} />
            </View>

            <Divider style={{ marginVertical: 16 }} />
            
            <Text variant="titleMedium">Image</Text>
            {formData.image ? (
              <Image source={{ uri: formData.image }} style={{ width: '100%', height: 200, borderRadius: 8, marginVertical: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickImage} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              {formData.image ? 'Change Image' : 'Upload Image'}
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
