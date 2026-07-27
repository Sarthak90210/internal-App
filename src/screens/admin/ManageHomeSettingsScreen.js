import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Video, Upload, RotateCcw, FileText, Clock } from '../../lib/lucideIcons';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { deleteCloudinaryImage, logAdminAction } from '../../services/adminApi';
import { pickAndUploadMedia } from '../../lib/mediaUpload';
import { useAuthStore } from '../../stores/authStore';
import { 
  AppSection, 
  AppCard, 
  AppInput, 
  AppButton, 
  AppBadge 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const EMPTY_SETTINGS = {
  backgroundVideoUrl: '',
  aboutUs: '',
  updatedAt: null,
  updatedBy: ''
};

const isMediaUrl = (value) => {
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized.includes('res.cloudinary.com')
    || normalized.includes('/video/upload/')
    || normalized.endsWith('.mp4')
    || normalized.endsWith('.webm')
    || normalized.endsWith('.mov');
};

export default function ManageHomeSettingsScreen() {
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
        setHomeVideoUrl(typeof data.backgroundVideoUrl === 'string' ? data.backgroundVideoUrl : '');
        setAboutUs(typeof data.aboutUs === 'string' && !isMediaUrl(data.aboutUs) ? data.aboutUs : '');
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
    if (isMediaUrl(aboutUs)) {
      Alert.alert("Invalid About Us Text", "Please enter About Us copy, not a video or Cloudinary URL.");
      return;
    }

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
    setIsUploading(true);
    try {
      const result = await pickAndUploadMedia({
        folder: 'home',
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled) return;

      if (result.ok) {
        setHomeVideoUrl(result.url);
      } else {
        Alert.alert('Upload Failed', result.error);
      }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppSection title="Home Page Background Video">
        <AppCard variant="surface" style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Video size={20} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Hero Reel Stream</Text>
              <Text style={styles.cardSub}>Plays automatically in loop on the public landing screen</Text>
            </View>
            {!!homeSettings?.backgroundVideoUrl && (
              <AppBadge variant="success">Active</AppBadge>
            )}
          </View>

          <View style={styles.uploadBox}>
            <AppButton 
              variant="secondary" 
              icon={<Upload size={16} color={appColors.textPrimary} />} 
              onPress={handlePickVideo}
              loading={isUploading}
              disabled={isUploading || isSavingVideo}
              style={{ width: '100%' }}
            >
              {isUploading ? "Uploading Video File..." : "Upload Video File to Cloud Storage"}
            </AppButton>
            
            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR DIRECT URL</Text>
              <View style={styles.line} />
            </View>

            <AppInput
              label="Cloudinary Stream URL (.mp4 / .webm)"
              value={homeVideoUrl}
              onChangeText={setHomeVideoUrl}
              placeholder="https://res.cloudinary.com/..."
              editable={!isUploading && !isSavingVideo}
            />
          </View>

          <View style={styles.actionRow}>
            {!!homeSettings?.backgroundVideoUrl && (
              <AppButton 
                variant="ghost" 
                icon={<RotateCcw size={16} color="#EF4444" />}
                style={{ flex: 1, marginRight: 8, borderColor: '#EF444450', borderWidth: 1 }}
                onPress={handleRevertHomeVideo}
                disabled={isUploading || isSavingVideo}
              >
                <Text style={{ color: '#EF4444', ...appTypography.button }}>Revert Default</Text>
              </AppButton>
            )}
            <AppButton 
              variant="primary" 
              onPress={handleHomeVideoSubmit}
              loading={isSavingVideo}
              disabled={isUploading || isSavingVideo || !homeVideoUrl}
              style={{ flex: 1 }}
            >
              Save Video Stream
            </AppButton>
          </View>
        </AppCard>
      </AppSection>

      <AppSection title="About Us Section & Mission" style={{ marginTop: appSpacing.xl }}>
        <AppCard variant="surface" style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#A855F715' }]}>
              <FileText size={20} color="#A855F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Team Narrative</Text>
              <Text style={styles.cardSub}>Displayed below the hero section on the home page</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <AppInput
              label="About Us Text (Markdown Supported)"
              value={aboutUs}
              onChangeText={setAboutUs}
              multiline
              numberOfLines={8}
              placeholder="Tell visitors about Team Rotor FPV, our engineering focus, and drone projects..."
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <AppButton 
              variant="primary" 
              onPress={handleAboutSubmit}
              loading={isSavingAbout}
              disabled={isSavingAbout}
              style={{ width: '100%' }}
            >
              Save About Us Text
            </AppButton>
          </View>

          {homeSettings?.updatedAt && (
            <View style={styles.metaBox}>
              <Clock size={14} color={appColors.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.updatedText}>
                Last updated: {homeSettings.updatedAt.toDate ? homeSettings.updatedAt.toDate().toLocaleString() : 'Recently'}
                {homeSettings.updatedBy && ` by ${homeSettings.updatedBy}`}
              </Text>
            </View>
          )}
        </AppCard>
      </AppSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: appSpacing.xl,
    paddingBottom: 100,
  },
  card: {
    padding: appSpacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: appRadius.md,
    backgroundColor: `${appColors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  cardSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  uploadBox: {
    backgroundColor: appColors.elevatedSurface,
    padding: appSpacing.lg,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: appColors.border,
  },
  orText: {
    ...appTypography.captionBold,
    color: appColors.textMuted,
    marginHorizontal: 12,
    fontSize: 10,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  updatedText: {
    ...appTypography.caption,
    color: appColors.textMuted,
    fontSize: 11,
  },
});
