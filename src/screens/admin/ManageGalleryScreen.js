import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, Image } from 'react-native';
import { List, FAB, useTheme, ActivityIndicator, Text, Button, TextInput, Switch, IconButton, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { GalleryService } from '../../services/gallery';
import { useAuthStore } from '../../stores/authStore';
import { uploadFile } from '../../services/adminApi';

const EMPTY_GALLERY = {
  img: '',
  order: 0,
  originalWidth: null,
  originalHeight: null
};

export default function ManageGalleryScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_GALLERY);
  const [isSaving, setIsSaving] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState({ heroImageUrl: '' });

  useEffect(() => {
    const unsubscribeGallery = GalleryService.subscribeToGallery((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubscribeSettings = GalleryService.subscribeToGallerySettings((data) => {
      setPageSettings(data);
    });
    return () => {
      unsubscribeGallery();
      unsubscribeSettings();
    };
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_GALLERY);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      img: item.img || '',
      order: item.order || 0,
      originalWidth: item.originalWidth || null,
      originalHeight: item.originalHeight || null
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete this image?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => GalleryService.deleteGalleryItem(item) }
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
        const folder = `gallery`;
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          setFormData(prev => ({ 
            ...prev, 
            img: data.secure_url,
            originalWidth: data.width || 600,
            originalHeight: data.height || 400
          }));
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
    if (!formData.img) {
      Alert.alert('Required', 'An image URL is required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { 
        ...formData, 
        order: Number(formData.order),
        originalWidth: formData.originalWidth || 600,
        originalHeight: formData.originalHeight || 400
      };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await GalleryService.updateGalleryItem(editingId, oldItem, dataToSave, user?.email);
      } else {
        await GalleryService.addGalleryItem(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save gallery item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await GalleryService.updateGallerySettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      Alert.alert('Success', 'Page settings updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsSaving(true);
      try {
        const { ok, data } = await uploadFile(uri, 'gallery');
        if (ok && data.secure_url) {
           setPageSettings({ heroImageUrl: data.secure_url });
        }
      } catch(e) {
        Alert.alert('Error', 'Failed to upload');
      } finally {
        setIsSaving(false);
      }
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
          contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={
            <Button 
               mode="contained-tonal" 
               icon="image" 
               onPress={() => setSettingsModalVisible(true)}
               style={{ marginBottom: 16, marginTop: 8 }}
            >
              Edit Hero Image
            </Button>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              {item.img ? (
                <Image source={{ uri: item.img }} style={styles.image} />
              ) : (
                <View style={[styles.image, { backgroundColor: theme.colors.surfaceVariant }]} />
              )}
              <View style={styles.cardContent}>
                <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">Order: {item.order}</Text>
                <View style={styles.actions}>
                  <IconButton icon="pencil" size={18} iconColor={theme.colors.primary} onPress={() => openEditModal(item)} />
                  <IconButton icon="delete" size={18} iconColor={theme.colors.error} onPress={() => handleDelete(item)} />
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No images found.
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

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
            <Text variant="titleLarge">{editingId ? 'Edit Image' : 'Add Image'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
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
            {formData.img ? (
              <Image source={{ uri: formData.img }} style={{ width: '100%', height: 200, borderRadius: 8, marginVertical: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickImage} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              {formData.img ? 'Change Image' : 'Upload Image'}
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={settingsModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setSettingsModalVisible(false)} />
            <Text variant="titleLarge">Gallery Hero Image</Text>
            <Button disabled={isSaving} onPress={handleSaveSettings}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text variant="titleMedium">Hero Image</Text>
            {pageSettings.heroImageUrl ? (
              <Image source={{ uri: pageSettings.heroImageUrl }} style={{ width: '100%', height: 200, resizeMode: 'cover', marginVertical: 8, borderRadius: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickSettingsImage} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              Upload Hero Image
            </Button>
          </ScrollView>
        </SafeAreaView>
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
  },
  card: {
    width: '48%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
  }
});
