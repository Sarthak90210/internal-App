import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import InventoryListsScreen from '../screens/inventory/InventoryListsScreen';
import InventoryDetailScreen from '../screens/inventory/InventoryDetailScreen';
import FolderDetailScreen from '../screens/inventory/FolderDetailScreen';
import ItemDetailScreen from '../screens/inventory/ItemDetailScreen';

const Stack = createNativeStackNavigator();

export default function InventoryStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="InventoryLists" component={InventoryListsScreen} options={{ title: 'Inventory Lists', headerShown: false }} />
      <Stack.Screen name="InventoryDetail" component={InventoryDetailScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="FolderDetail" component={FolderDetailScreen} options={{ title: 'Folder' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item Detail' }} />
    </Stack.Navigator>
  );
}
