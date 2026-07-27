import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { CloudDownload, AlertCircle, CheckCircle2, X, Sparkles } from '../lib/lucideIcons';
import { useUpdateStore } from '../stores/updateStore';
import { AppModal, AppButton } from './design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../theme';

export default function UpdatePromptModal() {
  const {
    isUpdateAvailable,
    isDownloading,
    error,
    notice,
    checkForUpdate,
    downloadAndReload,
    dismissPrompt,
    clearError,
    clearNotice,
  } = useUpdateStore();

  useEffect(() => {
    // Perform an automatic update check 2.5 seconds after app startup
    const timer = setTimeout(() => {
      checkForUpdate(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return (
    <>
      <AppModal
        visible={isUpdateAvailable}
        onClose={isDownloading ? (() => {}) : dismissPrompt}
        title={isDownloading ? 'Updating RFV Client...' : 'Update Available'}
        footer={
          !isDownloading ? (
            <View style={styles.actionsRow}>
              <AppButton
                variant="ghost"
                onPress={dismissPrompt}
                style={{ flex: 1, marginRight: 8 }}
              >
                Later
              </AppButton>
              <AppButton
                variant="primary"
                onPress={downloadAndReload}
                style={{ flex: 1 }}
                icon={<CloudDownload size={16} color={appColors.background} />}
              >
                Update Now
              </AppButton>
            </View>
          ) : null
        }
      >
        <View style={styles.contentContainer}>
          <View style={styles.iconBox}>
            {isDownloading ? (
              <ActivityIndicator size="large" color={appColors.accent} />
            ) : (
              <Sparkles size={32} color={appColors.accent} />
            )}
          </View>

          {isDownloading ? (
            <View style={styles.textWrap}>
              <Text style={styles.mainTitle}>Applying Update...</Text>
              <Text style={styles.mainMessage}>
                Downloading and applying the latest RFV binary build. The application will reboot automatically in just a moment.
              </Text>
            </View>
          ) : (
            <View style={styles.textWrap}>
              <Text style={styles.mainTitle}>New Version Ready</Text>
              <Text style={styles.mainMessage}>
                A new version of RFV is ready! It includes new telemetry enhancements, visual upgrades, and performance optimizations. Would you like to install it now?
              </Text>
            </View>
          )}
        </View>
      </AppModal>

      {/* Error Floating Toast */}
      {error ? (
        <View style={[styles.toastContainer, styles.toastError]}>
          <AlertCircle size={20} color="#EF4444" style={{ marginRight: 10 }} />
          <Text style={[styles.toastText, { color: '#EF4444' }]}>{error}</Text>
          <Pressable onPress={clearError} style={styles.toastCloseBtn}>
            <X size={16} color="#EF4444" />
          </Pressable>
        </View>
      ) : null}

      {/* Notice/Info Floating Toast */}
      {notice ? (
        <View style={[styles.toastContainer, styles.toastNotice]}>
          <CheckCircle2 size={20} color={appColors.accent} style={{ marginRight: 10 }} />
          <Text style={[styles.toastText, { color: appColors.textPrimary }]}>{notice}</Text>
          <Pressable onPress={clearNotice} style={styles.toastCloseBtn}>
            <X size={16} color={appColors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: appSpacing.md,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: appRadius.full,
    backgroundColor: `${appColors.accent}15`,
    borderWidth: 1,
    borderColor: `${appColors.accent}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  textWrap: {
    alignItems: 'center',
  },
  mainTitle: {
    ...appTypography.h2,
    color: appColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  mainMessage: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 20,
    right: 20,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderRadius: appRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  toastError: {
    borderColor: '#EF444450',
    backgroundColor: '#1C1315',
  },
  toastNotice: {
    borderColor: `${appColors.accent}40`,
    backgroundColor: appColors.elevatedSurface,
  },
  toastText: {
    ...appTypography.bodyBold,
    flex: 1,
    fontSize: 13,
  },
  toastCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
});

