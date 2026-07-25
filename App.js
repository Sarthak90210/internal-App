import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { customDarkTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import UpdatePromptModal from './src/components/UpdatePromptModal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={customDarkTheme}>
        <StatusBar style="light" />
        <AppNavigator />
        <UpdatePromptModal />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
