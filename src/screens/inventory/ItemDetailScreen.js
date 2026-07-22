import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme, Text, Card, Button } from 'react-native-paper';

export default function ItemDetailScreen({ route, navigation }) {
  const theme = useTheme();
  const { itemData } = route.params;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
            {itemData.name}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.primary, marginTop: 8 }}>
            Quantity: {itemData.quantity || 0}
          </Text>
          
          <View style={styles.detailsBlock}>
            <Text style={{ color: theme.colors.onSurface }}>
              <Text style={{ fontWeight: 'bold' }}>Part Number:</Text> {itemData.partNumber || 'N/A'}
            </Text>
            <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>
              <Text style={{ fontWeight: 'bold' }}>Description:</Text> {itemData.description || 'No description provided.'}
            </Text>
          </View>
        </Card.Content>
      </Card>
      
      <Button mode="contained" onPress={() => console.log('Edit Item')} style={styles.button}>
        Edit Item
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 16 },
  detailsBlock: { marginTop: 16, gap: 8 },
  button: { marginTop: 8, borderRadius: 8 }
});
