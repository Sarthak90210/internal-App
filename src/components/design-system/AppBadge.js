import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appColors, appRadius } from '../../theme';

export default function AppBadge({
  children,
  // Semantic variants:  'default' | 'success' | 'warning' | 'danger' | 'accent'
  //                   | 'primary' | 'secondary' | 'admin' | 'superAdmin'
  // Status passthroughs: 'active' | 'inactive' | 'Available' | 'Missing' | 'CheckedOut'
  variant = 'default',
  style,
  textStyle,
  ...props
}) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
      case 'active':
      case 'Available':
        return { bg: appColors.successMuted, text: appColors.success, border: appColors.success };
      case 'warning':
      case 'Missing':
      case 'inactive':
        return { bg: appColors.warningMuted, text: appColors.warning, border: appColors.warning };
      case 'danger':
      case 'CheckedOut':
        return { bg: appColors.dangerMuted, text: appColors.danger, border: appColors.danger };
      case 'accent':
      case 'primary':
      case 'admin':
        return { bg: appColors.accentMuted, text: appColors.accent, border: appColors.accent };
      case 'secondary':
        return { bg: appColors.surfaceHighlight, text: appColors.textSecondary, border: appColors.border };
      case 'superAdmin':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: '#A855F7' }; // Purple tint for Super Admin
      default:
        return { bg: appColors.elevatedSurface, text: appColors.textSecondary, border: appColors.border };
    }
  };

  const current = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: current.bg, borderColor: current.border },
        style,
      ]}
      {...props}
    >
      <Text style={[styles.text, { color: current.text }, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: appRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
