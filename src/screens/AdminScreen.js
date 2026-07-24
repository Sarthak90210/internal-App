import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

export default function AdminScreen({ navigation }) {
  const handleLogout = () => {
    // Implement sign out logic here
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text>Manage Events and Gallery here.</Text>
      
      <View style={{ marginTop: 20 }}>
        <Button title="Sign Out" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
