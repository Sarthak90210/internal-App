import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Avatar, Text, useTheme, Button, Divider, List } from 'react-native-paper';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../services/auth';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, roles } = useAuthStore();

  const handleLogout = () => {
    AuthService.logout();
  };

  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  const userRoles = Object.entries(roles)
    .filter(([_, value]) => value)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
    .join(', ') || 'Member';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Avatar.Text 
          size={80} 
          label={getInitials(user?.displayName, user?.email)} 
          style={{ backgroundColor: theme.colors.primary, marginBottom: 16 }} 
        />
        <Text variant="headlineMedium" style={{ color: theme.colors.onBackground, fontWeight: 'bold' }}>
          {user?.displayName || 'User'}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {user?.email || 'No email provided'}
        </Text>
      </View>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>Account Information</List.Subheader>
        <List.Item
          title="Team/Role"
          description={userRoles}
          left={props => <List.Icon {...props} icon="shield-account" />}
        />
        <List.Item
          title="App Version"
          description="1.0.0" // Hardcoded for now, could be dynamic later
          left={props => <List.Icon {...props} icon="information-outline" />}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <View style={styles.buttonContainer}>
        <Button 
          mode="contained-tonal" 
          onPress={handleLogout} 
          icon="logout"
          buttonColor={theme.colors.errorContainer}
          textColor={theme.colors.onErrorContainer}
          style={styles.logoutButton}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
  },
  buttonContainer: {
    padding: 24,
    marginTop: 16,
  },
  logoutButton: {
    paddingVertical: 6,
  }
});
