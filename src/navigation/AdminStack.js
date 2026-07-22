import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ManageEventsScreen from '../screens/admin/ManageEventsScreen';
import ManageDronesScreen from '../screens/admin/ManageDronesScreen';
import ManageGalleryScreen from '../screens/admin/ManageGalleryScreen';
import ManageTeamScreen from '../screens/admin/ManageTeamScreen';
import ManageAchievementsScreen from '../screens/admin/ManageAchievementsScreen';
import ManageGoogleSheetsScreen from '../screens/admin/ManageGoogleSheetsScreen';
import ManageHomeSettingsScreen from '../screens/admin/ManageHomeSettingsScreen';
import ManageLogsScreen from '../screens/admin/ManageLogsScreen';
import ManageSponsorsScreen from '../screens/admin/ManageSponsorsScreen';
import ManageTrafficScreen from '../screens/admin/ManageTrafficScreen';
import ManageContactMessagesScreen from '../screens/admin/ManageContactMessagesScreen';
import ManageTeamMembersScreen from '../screens/admin/ManageTeamMembersScreen';

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="ManageEvents" component={ManageEventsScreen} options={{ title: 'Manage Events' }} />
      <Stack.Screen name="ManageDrones" component={ManageDronesScreen} options={{ title: 'Manage Drones' }} />
      <Stack.Screen name="ManageGallery" component={ManageGalleryScreen} options={{ title: 'Manage Gallery' }} />
      <Stack.Screen name="ManageTeam" component={ManageTeamScreen} options={{ title: 'Manage Team' }} />
      <Stack.Screen name="ManageAchievements" component={ManageAchievementsScreen} options={{ title: 'Manage Achievements' }} />
      <Stack.Screen name="ManageGoogleSheets" component={ManageGoogleSheetsScreen} options={{ title: 'Manage Google Sheets' }} />
      <Stack.Screen name="ManageHomeSettings" component={ManageHomeSettingsScreen} options={{ title: 'Manage Home Settings' }} />
      <Stack.Screen name="ManageLogs" component={ManageLogsScreen} options={{ title: 'Manage Logs' }} />
      <Stack.Screen name="ManageSponsors" component={ManageSponsorsScreen} options={{ title: 'Manage Sponsors' }} />
      <Stack.Screen name="ManageTraffic" component={ManageTrafficScreen} options={{ title: 'Manage Traffic' }} />
      <Stack.Screen name="ManageContactMessages" component={ManageContactMessagesScreen} options={{ title: 'Manage Messages' }} />
      <Stack.Screen name="ManageTeamMembers" component={ManageTeamMembersScreen} options={{ title: 'Manage Team Members' }} />
    </Stack.Navigator>
  );
}
