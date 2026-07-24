import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, useTheme, IconButton } from 'react-native-paper';
import { useAuthStore } from '../../stores/authStore';

const adminModules = [
  { title: "Gallery", route: "ManageGallery", icon: "image-multiple", permission: "media" },
  { title: "Sponsors", route: "ManageSponsors", icon: "handshake", permission: "board" },
  { title: "Home Page", route: "ManageHomeSettings", icon: "home-edit", permission: "admin" },
  { title: "Achievements", route: "ManageAchievements", icon: "trophy", permission: "board" },
  { title: "Board", route: "ManageTeam", icon: "account-group", permission: "board" },
  { title: "Events", route: "ManageEvents", icon: "calendar", permission: "board" },
  { title: "Messages", route: "ManageContactMessages", icon: "message-text", permission: "board" },
  { title: "Team Members", route: "ManageTeamMembers", icon: "account-cog", permission: "superAdmin" },
];

export default function AdminDashboardScreen({ navigation }) {
  const theme = useTheme();
  const { hasPermission } = useAuthStore();

  const getIconColor = (permission) => {
    switch (permission) {
      case 'inventory': return theme.colors.warning;
      case 'board': return theme.colors.error;
      case 'media': return theme.colors.success;
      case 'admin': return theme.colors.primary;
      default: return theme.colors.primary;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, margin: 16, fontWeight: 'bold' }}>
        Dashboard Overview
      </Text>
      
      <View style={styles.grid}>
        {adminModules.map((module) => {
          // Verify if user has permission to see this module
          const canAccess = hasPermission(module.permission);
          
          if (!canAccess) return null;

          return (
            <Card 
              key={module.route}
              style={styles.card} 
              onPress={() => navigation.navigate(module.route)}
            >
              <Card.Content>
                <IconButton 
                  icon={module.icon} 
                  size={30} 
                  iconColor={getIconColor(module.permission)} 
                  style={styles.icon} 
                />
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>{module.title}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Manage {module.title.toLowerCase()}</Text>
              </Card.Content>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  card: {
    width: '45%',
    margin: '2.5%',
    marginBottom: 16,
  },
  icon: {
    margin: 0,
    marginBottom: 8,
    alignSelf: 'flex-start',
    marginLeft: -8,
  }
});
