import React, { useState } from 'react';
import { View, StyleSheet, Alert, Image, Text } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AuthService } from '../services/auth';
import { AppButton } from '../components/design-system';
import { appColors, appSpacing, appTypography } from '../theme';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '361893112217-i97p3ab2bd28rku8k5g6sish7u8018de.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '361893112217-r4kaaeo8rhjl9nmf26de863kcn5bt606.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

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
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.brandMark}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={styles.logo} 
          />
        </View>
        <Text style={styles.title}>Team Rotor FPV</Text>
        <Text style={styles.subtitle}>Internal Engineering Platform</Text>
        
        <View style={styles.buttonWrapper}>
          <AppButton 
            onPress={handleGoogleLogin} 
            loading={loading}
            fullWidth
            size="lg"
          >
            Sign in with Google
          </AppButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: appSpacing.xxl,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  brandMark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: appColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: appColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  logo: { width: 56, height: 56, resizeMode: 'contain' },
  title: { 
    ...appTypography.pageTitle, 
    fontSize: 26, 
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: { 
    ...appTypography.caption, 
    color: appColors.textMuted,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
});

