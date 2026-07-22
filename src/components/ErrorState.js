import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, Button, Icon } from 'react-native-paper';
import { useNetInfo } from '@react-native-community/netinfo';

export default function ErrorState({ 
  title = "Something went wrong", 
  message = "An error occurred.", 
  onRetry, 
  isOfflineError = false 
}) {
  const theme = useTheme();
  const netInfo = useNetInfo();

  const isActuallyOffline = !netInfo.isConnected && netInfo.isConnected !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Icon 
        source={isActuallyOffline || isOfflineError ? "wifi-off" : "alert-circle-outline"} 
        color={theme.colors.error} 
        size={64} 
      />
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, marginTop: 16, fontWeight: 'bold' }}>
        {isActuallyOffline ? "You're Offline" : title}
      </Text>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginVertical: 8, marginHorizontal: 32 }}>
        {isActuallyOffline ? "Changes will be saved locally and synced when you reconnect." : message}
      </Text>
      {onRetry && (
        <Button mode="contained" onPress={onRetry} style={{ marginTop: 16 }} buttonColor={theme.colors.primary}>
          Retry
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  }
});
