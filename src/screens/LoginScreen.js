import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Button, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AuthService } from '../services/auth';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '361893112217-i97p3ab2bd28rku8k5g6sish7u8018de.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '361893112217-r4kaaeo8rhjl9nmf26de863kcn5bt606.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleGoogleLogin = async () => {
    setLoading(true);
    
    // Safety timeout — if sign-in hangs for 30 seconds, reset the button
    const timeout = setTimeout(() => {
      setLoading(false);
      Alert.alert('Sign In Timeout', 'Google Sign-In took too long. Please try again.');
    }, 30000);

    try {
      // Check if your device supports Google Play Services (without showing blocking dialog)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
      
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
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Image 
        source={require('../../assets/images/logo.png')} 
        style={{ width: 100, height: 100, marginBottom: 16, resizeMode: 'contain' }} 
      />
      <Text variant="headlineMedium" style={{ color: theme.colors.onBackground, fontWeight: 'bold', marginBottom: 10 }}>
        RFV
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
