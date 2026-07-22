import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AuthService } from '../services/auth';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    // Configure GoogleSignin when the component mounts
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      // You can add additional scopes if needed
      // scopes: ['profile', 'email'], 
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Check if your device supports Google Play Services
      await GoogleSignin.hasPlayServices();
      
      // Perform the sign in
      await GoogleSignin.signIn();
      
      // Wait to grab the idToken
      const { idToken } = await GoogleSignin.getTokens();
      
      if (idToken) {
        await AuthService.signInWithGoogleToken(idToken);
      } else {
        throw new Error('No ID token present!');
      }
    } catch (error) {
      console.error('Login Failed:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
        Alert.alert('Sign in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
        Alert.alert('Google Play Services is not available');
      } else {
        // some other error happened
        Alert.alert('Login Failed', error.message);
      }
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={{ color: theme.colors.onBackground, fontWeight: 'bold', marginBottom: 10 }}>
        Team Rotor FPV
      </Text>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 40 }}>
        Internal Management App
      </Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : (
        <Button 
          mode="contained" 
          onPress={handleGoogleLogin} 
          icon="google" 
          style={{ borderRadius: 8 }}
        >
          Sign in with Google
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
    padding: 20,
  },
});
