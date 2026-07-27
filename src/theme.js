import { MD3DarkTheme } from 'react-native-paper';

export const appColors = {
  background: '#0B0A10',
  surface: '#12111A',
  elevatedSurface: '#191825',
  border: '#2A293D',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accent: '#8B5CF6',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  // Semantic aliases. These must stay 6-digit hex: several screens build
  // translucent tints by string-concatenating an alpha suffix, e.g.
  // `${appColors.primary}15`, which breaks if the value is an rgba() string.
  primary: '#8B5CF6',   // === accent
  secondary: '#94A3B8', // === textSecondary
  // Helper variations for overlays and badges
  accentMuted: 'rgba(139, 92, 246, 0.15)',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.05)',
  backdrop: 'rgba(0, 0, 0, 0.75)',
};

export const appSpacing = {
  xs: 4,
  sm: 8,
  md: 10,  // Gap between controls
  lg: 16,
  xl: 18,  // Card padding
  xxl: 24, // Horizontal page padding
  section: 28, // Vertical spacing between sections
};

export const appRadius = {
  sm: 8,
  md: 12,
  button: 14, // Primary Button radius
  card: 16,   // Card radius
  lg: 20,     // Floating bars and toasts
  pill: 9999, // Badges and Bottom Nav
  full: 9999, // Alias of pill, for circular avatars and icon wells
};

export const appTypography = {
  pageTitle: { fontSize: 32, fontWeight: '700', color: appColors.textPrimary, letterSpacing: -0.5 },
  title: { fontSize: 28, fontWeight: '700', color: appColors.textPrimary, letterSpacing: -0.4 },
  sectionTitle: { fontSize: 22, fontWeight: '600', color: appColors.textPrimary, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700', color: appColors.textPrimary, letterSpacing: -0.2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: appColors.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: appColors.textPrimary, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', color: appColors.textPrimary, lineHeight: 22 },
  bodySecondary: { fontSize: 15, fontWeight: '400', color: appColors.textSecondary, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', color: appColors.textSecondary },
  captionBold: { fontSize: 13, fontWeight: '600', color: appColors.textSecondary },
  metadata: { fontSize: 12, fontWeight: '500', color: appColors.textMuted },
  button: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  buttonBold: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
};

export const customDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: appColors.accent,
    onPrimary: '#09090B',
    primaryContainer: appColors.accentMuted,
    onPrimaryContainer: appColors.accent,
    secondary: appColors.textSecondary,
    background: appColors.background,
    surface: appColors.surface,
    surfaceVariant: appColors.elevatedSurface,
    card: appColors.surface,
    onSurface: appColors.textPrimary,
    onSurfaceVariant: appColors.textSecondary,
    onSurfaceDisabled: appColors.textMuted,
    outline: appColors.border,
    success: appColors.success,
    warning: appColors.warning,
    error: appColors.danger,
    elevation: {
      level0: 'transparent',
      level1: appColors.surface,
      level2: appColors.elevatedSurface,
      level3: appColors.elevatedSurface,
      level4: appColors.elevatedSurface,
      level5: appColors.elevatedSurface,
    },
  },
};

