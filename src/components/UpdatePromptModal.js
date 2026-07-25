import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Portal, Dialog, Button, Text, Snackbar, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useUpdateStore } from '../stores/updateStore';

export default function UpdatePromptModal() {
  const theme = useTheme();
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
      <Portal>
        <Dialog
          visible={isUpdateAvailable}
          onDismiss={isDownloading ? undefined : dismissPrompt}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.headerContainer}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons
                name="rocket-launch-outline"
                size={32}
                color={theme.colors.primary}
              />
            </View>
            <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
              {isDownloading ? 'Updating RFV...' : 'Update Available'}
            </Dialog.Title>
          </View>

          <Dialog.Content style={styles.content}>
            {isDownloading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
                <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                  Downloading and applying the latest update. The app will restart automatically in just a moment...
                </Text>
              </View>
            ) : (
              <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                A new version of RFV is ready! It includes new features, performance improvements, and bug fixes. Would you like to install it now?
              </Text>
            )}
          </Dialog.Content>

          {!isDownloading && (
            <Dialog.Actions style={styles.actions}>
              <Button
                mode="text"
                onPress={dismissPrompt}
                textColor={theme.colors.onSurfaceVariant}
                style={styles.button}
              >
                Later
              </Button>
              <Button
                mode="contained"
                onPress={downloadAndReload}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                style={styles.button}
                icon="cloud-download-outline"
              >
                Update Now
              </Button>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>

      {/* Error Snackbar */}
      <Snackbar
        visible={!!error}
        onDismiss={clearError}
        duration={5000}
        style={{ backgroundColor: theme.colors.errorContainer }}
        action={{
          label: 'Dismiss',
          labelStyle: { color: theme.colors.error },
          onPress: clearError,
        }}
      >
        <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
      </Snackbar>

      {/* Notice/Info Snackbar */}
      <Snackbar
        visible={!!notice}
        onDismiss={clearNotice}
        duration={4000}
        style={{ backgroundColor: theme.colors.surfaceVariant }}
        action={{
          label: 'OK',
          labelStyle: { color: theme.colors.primary },
          onPress: clearNotice,
        }}
      >
        <Text style={{ color: theme.colors.onSurface }}>{notice}</Text>
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 24,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 0,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  button: {
    borderRadius: 12,
    minWidth: 100,
  },
});
