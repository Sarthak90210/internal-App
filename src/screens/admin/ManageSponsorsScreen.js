import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { List, FAB, useTheme, ActivityIndicator, Text, Button, TextInput, Switch, IconButton, Divider, Searchbar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { SponsorsService } from '../../services/sponsors';
import { useAuthStore } from '../../stores/authStore';
import { uploadFile } from '../../services/adminApi';

const EMPTY_SPONSOR = {
  name: '',
  website: '',
  logo: '',
  order: 0,
  isActive: true
};

const DEFAULT_PAGE_SETTINGS = {
  title: 'Sponsor Us',
  description: '',
  teamImage: { url: '', publicId: '' },
  brochure: { url: '', publicId: '', name: '' },
  whySponsorUs: ''
};

export default function ManageSponsorsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SPONSOR);
  const [isSaving, setIsSaving] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);

  useEffect(() => {
    const unsubscribeSponsors = SponsorsService.subscribeToSponsors((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubscribeSettings = SponsorsService.subscribeToSponsorSettings((data) => {
      setPageSettings(data);
    });
    return () => {
      unsubscribeSponsors();
      unsubscribeSettings();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const lowerQ = searchQuery.toLowerCase();
    return items.filter(t => t.name?.toLowerCase().includes(lowerQ));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_SPONSOR);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      website: item.website || '',
      logo: item.logo || '',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => SponsorsService.deleteSponsor(item) }
    ]);
  };

  const handlePickImage = async () => {
    if (!formData.name) {
      Alert.alert('Required', 'Please enter a name first.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsSaving(true);
      try {
        const safeName = formData.name.trim().replace(/\s+/g, '-');
        const folder = `sponsors/${safeName}`;
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          setFormData(prev => ({ ...prev, logo: data.secure_url }));
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
    if (!formData.name || !formData.logo) {
      Alert.alert('Required', 'Name and Logo are required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      
      if (editingId) {
        const oldItem = items.find(e => e.id === editingId);
        await SponsorsService.updateSponsor(editingId, oldItem, dataToSave, user?.email);
      } else {
        await SponsorsService.addSponsor(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save sponsor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await SponsorsService.updateSponsorSettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      Alert.alert('Success', 'Page settings updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'brochure' ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images, // Simplified for brevity
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsSaving(true);
      try {
        const folder = type === 'teamImage' ? 'sponsor-us/team-image' : 'sponsor-us';
        const { ok, data } = await uploadFile(uri, folder);
        if (ok && data.secure_url) {
          if (type === 'teamImage') {
             setPageSettings(prev => ({ ...prev, teamImage: { url: data.secure_url, publicId: data.public_id || '' } }));
          } else {
             setPageSettings(prev => ({ ...prev, brochure: { url: data.secure_url, publicId: data.public_id || '', name: 'Uploaded Brochure' } }));
          }
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
      <View style={{ padding: 16 }}>
        <Searchbar
          placeholder="Search sponsors..."
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
          ListHeaderComponent={
            <Button 
               mode="contained-tonal" 
               icon="cog" 
               onPress={() => setSettingsModalVisible(true)}
               style={{ marginHorizontal: 16, marginBottom: 8 }}
            >
              Edit Page Settings
            </Button>
          }
          renderItem={({ item }) => (
            <List.Item
              title={item.name || 'Untitled Sponsor'}
              description={`Order: ${item.order}`}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              style={{ backgroundColor: theme.colors.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 8 }}
              left={props => (
                 item.logo ? 
                  <Image source={{ uri: item.logo }} style={{ width: 50, height: 50, borderRadius: 25, margin: 8 }} />
                  : <List.Icon {...props} icon="star" color={theme.colors.primary} />
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
              No sponsors found.
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
            <Text variant="titleLarge">{editingId ? 'Edit Sponsor' : 'Add Sponsor'}</Text>
            <Button disabled={isSaving} onPress={handleSave}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="Sponsor Name"
              value={formData.name}
              onChangeText={t => setFormData({...formData, name: t})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Website URL"
              value={formData.website}
              onChangeText={t => setFormData({...formData, website: t})}
              style={styles.input}
              mode="outlined"
              keyboardType="url"
              autoCapitalize="none"
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

            <Divider style={{ marginVertical: 16 }} />
            
            <Text variant="titleMedium">Logo</Text>
            {formData.logo ? (
              <Image source={{ uri: formData.logo }} style={{ width: '100%', height: 100, resizeMode: 'contain', marginVertical: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={handlePickImage} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              {formData.logo ? 'Change Logo' : 'Upload Logo'}
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={settingsModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <IconButton icon="close" onPress={() => setSettingsModalVisible(false)} />
            <Text variant="titleLarge">Page Settings</Text>
            <Button disabled={isSaving} onPress={handleSaveSettings}>Save</Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              label="Description"
              value={pageSettings.description}
              onChangeText={t => setPageSettings({...pageSettings, description: t})}
              style={styles.input}
              mode="outlined"
              multiline
            />
             <TextInput
              label="Why Sponsor Us"
              value={pageSettings.whySponsorUs}
              onChangeText={t => setPageSettings({...pageSettings, whySponsorUs: t})}
              style={styles.input}
              mode="outlined"
              multiline
            />
            
            <Divider style={{ marginVertical: 16 }} />
            
            <Text variant="titleMedium">Team Image</Text>
            {pageSettings.teamImage?.url ? (
              <Image source={{ uri: pageSettings.teamImage.url }} style={{ width: '100%', height: 150, resizeMode: 'cover', marginVertical: 8 }} />
            ) : null}
            <Button mode="outlined" onPress={() => handlePickSettingsImage('teamImage')} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              Upload Team Image
            </Button>

             <Divider style={{ marginVertical: 16 }} />
            
            <Text variant="titleMedium">Brochure PDF</Text>
            {pageSettings.brochure?.url ? (
              <Text style={{ marginVertical: 8, color: theme.colors.primary }}>Current: {pageSettings.brochure.name || 'PDF Uploaded'}</Text>
            ) : null}
            <Button mode="outlined" onPress={() => handlePickSettingsImage('brochure')} loading={isSaving} disabled={isSaving} style={{ marginTop: 8 }}>
              Upload Brochure
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
  }
});
