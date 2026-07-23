import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Card, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage, logAdminAction } from '../../services/adminApi';
import { useAuthStore } from '../../stores/authStore';
import * as ImagePicker from 'expo-image-picker';

const EMPTY_SETTINGS = {
  backgroundVideoUrl: '',
  aboutUs: '',
  updatedAt: null,
  updatedBy: ''
};

export default function ManageHomeSettingsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  
  const [homeSettings, setHomeSettings] = useState(EMPTY_SETTINGS);
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'home'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHomeSettings(data);
        setHomeVideoUrl(data.backgroundVideoUrl || '');
        setAboutUs(data.aboutUs || '');
      } else {
        setHomeSettings(EMPTY_SETTINGS);
        setHomeVideoUrl('');
        setAboutUs('');
      }
    }, (error) => {
      console.error("Error fetching home settings:", error);
    });
    return () => unsub();
  }, []);

  const handleAboutSubmit = async () => {
    setIsSavingAbout(true);
    try {
      await setDoc(doc(db, 'settings', 'home'), {
        aboutUs: aboutUs,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown'
      }, { merge: true });
      await logAdminAction('UPDATE', 'HomeSettings', 'Updated About Us text');
      Alert.alert("Success", "About Us section updated successfully!");
    } catch (error) {
      console.error("Error updating About Us:", error);
      Alert.alert("Error", "Failed to update About Us text.");
    } finally {
      setIsSavingAbout(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        
        setIsUploading(true);
        const { ok, data: uploadedMedia } = await uploadFile(fileUri, "home");
        
        if (ok && uploadedMedia.secure_url) {
          setHomeVideoUrl(uploadedMedia.secure_url);
        } else {
          Alert.alert("Upload Failed", uploadedMedia.error || "Please try again.");
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload video.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleHomeVideoSubmit = async () => {
    if (!homeVideoUrl) {
      Alert.alert("Missing Video", "Please provide a video URL or upload a file.");
      return;
    }
    
    setIsSavingVideo(true);
    try {
      if (homeSettings && homeSettings.backgroundVideoUrl && homeSettings.backgroundVideoUrl !== homeVideoUrl) {
        await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
      }

      await setDoc(doc(db, 'settings', 'home'), {
        backgroundVideoUrl: homeVideoUrl,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown'
      }, { merge: true });
      
      await logAdminAction('UPDATE', 'HomeSettings', 'Updated Home background video');
      Alert.alert("Success", "Home background video updated successfully!");
    } catch (error) {
      console.error("Error updating home video:", error);
      Alert.alert("Error", "Failed to update background video.");
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleRevertHomeVideo = () => {
    Alert.alert(
      "Revert to Default",
      "Are you sure you want to remove the custom background video and revert to the default?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Revert", 
          style: "destructive",
          onPress: async () => {
            setIsSavingVideo(true);
            try {
              if (homeSettings && homeSettings.backgroundVideoUrl) {
                await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
              }
              await setDoc(doc(db, 'settings', 'home'), {
                backgroundVideoUrl: '',
                updatedAt: serverTimestamp(),
                updatedBy: user?.email || 'unknown'
              }, { merge: true });
              setHomeVideoUrl('');
              await logAdminAction('UPDATE', 'HomeSettings', 'Reverted Home background video to default');
              Alert.alert("Success", "Reverted to default background video.");
            } catch (error) {
              console.error("Error reverting home video:", error);
              Alert.alert("Error", "Failed to revert video.");
            } finally {
              setIsSavingVideo(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card}>
        <Card.Title title="Background Video" subtitle="Plays in the background of the main home page" />
        <Card.Content>
          <View style={styles.uploadSection}>
            <Button 
              mode="outlined" 
              icon="upload" 
              onPress={handlePickVideo}
              disabled={isUploading || isSavingVideo}
            >
              {isUploading ? "Uploading..." : "Upload New Video"}
            </Button>
            
            <Text style={[styles.orText, { color: theme.colors.onSurfaceVariant }]}>or</Text>
            
            <TextInput
              label="Video URL (Cloudinary)"
              value={homeVideoUrl}
              onChangeText={setHomeVideoUrl}
              mode="outlined"
              placeholder="Paste a direct video URL"
              disabled={isUploading || isSavingVideo}
            />
          </View>
          
          <View style={styles.actionRow}>
            <Button 
              mode="contained" 
              onPress={handleHomeVideoSubmit}
              loading={isSavingVideo}
              disabled={isUploading || isSavingVideo || !homeVideoUrl}
              style={styles.actionBtn}
            >
              Save Video
            </Button>
            
            {!!homeSettings?.backgroundVideoUrl && (
              <Button 
                mode="outlined" 
                textColor={theme.colors.error}
                style={[styles.actionBtn, { borderColor: theme.colors.error }]}
                onPress={handleRevertHomeVideo}
                disabled={isUploading || isSavingVideo}
              >
                Revert
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { marginBottom: 40 }]}>
        <Card.Title title="About Us Section" subtitle="Appears below the video on the home page" />
        <Card.Content>
          <TextInput
            label="About Us Text"
            value={aboutUs}
            onChangeText={setAboutUs}
            mode="outlined"
            multiline
            numberOfLines={8}
            placeholder="Tell visitors about Team Rotor FPV..."
            style={styles.textArea}
          />
          
          <Button 
            mode="contained" 
            onPress={handleAboutSubmit}
            loading={isSavingAbout}
            disabled={isSavingAbout}
            style={styles.saveAboutBtn}
          >
            Save About Us
          </Button>

          {homeSettings?.updatedAt && (
            <Text style={[styles.updatedText, { color: theme.colors.onSurfaceVariant }]}>
              Last updated: {homeSettings.updatedAt.toDate ? homeSettings.updatedAt.toDate().toLocaleString() : 'Recently'}
              {homeSettings.updatedBy && ` by ${homeSettings.updatedBy}`}
            </Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 20,
  },
  uploadSection: {
    marginBottom: 16,
  },
  orText: {
    textAlign: 'center',
    marginVertical: 12,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
  textArea: {
    minHeight: 120,
    marginBottom: 16,
  },
  saveAboutBtn: {
    marginBottom: 16,
  },
  updatedText: {
    fontSize: 12,
    textAlign: 'center',
  }
});
