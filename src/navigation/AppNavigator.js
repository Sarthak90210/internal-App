import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { AuthService } from '../services/auth';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Screens
import LoginScreen from '../screens/LoginScreen';
import InventoryStack from './InventoryStack';
import AdminStack from './AdminStack';
import ProfileStack from './ProfileStack';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="InventoryTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.surfaceVariant },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceDisabled,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'InventoryTab') iconName = 'format-list-bulleted';
          else if (route.name === 'AdminTab') iconName = 'shield-account';
          else if (route.name === 'ProfileTab') iconName = 'account';
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="InventoryTab" component={InventoryStack} options={{ title: 'Inventory' }} />
      <Tab.Screen name="AdminTab" component={AdminStack} options={{ title: 'Admin' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuthStore();
  const theme = useTheme();

  useEffect(() => {
    const unsubscribe = AuthService.initializeAuthListener();
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={{
      ...DarkTheme,
      fonts: DarkTheme.fonts || {
        regular: { fontFamily: '', fontWeight: '400' },
        medium: { fontFamily: '', fontWeight: '500' },
        bold: { fontFamily: '', fontWeight: '700' },
        heavy: { fontFamily: '', fontWeight: '900' },
      },
      colors: {
        ...DarkTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.surfaceVariant,
        notification: theme.colors.error,
      }
    }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
