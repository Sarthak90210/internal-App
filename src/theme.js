import { MD3DarkTheme } from 'react-native-paper';

export const customDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2F81F7',
    background: '#0b1017',
    surface: '#111827',
    surfaceVariant: '#161f2b',
    card: '#161f2b',
    // Adding some contextual colors specified by user
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
};
