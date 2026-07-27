import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { appColors, appRadius, appSpacing } from '../../theme';

export default function AppChip({
  children,
  // Some screens pass `label` instead of children; support both so the chip
  // never renders empty.
  label,
  onPress,
  selected = false,
  icon,
  style,
  textStyle,
  ...props
}) {
  const content = children ?? label;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
      {...props}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textUnselected,
          textStyle,
        ]}
      >
        {content}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: appRadius.pill,
    borderWidth: 1,
    marginRight: appSpacing.sm,
    marginBottom: appSpacing.sm,
  },
  unselected: {
    backgroundColor: appColors.surface,
    borderColor: appColors.border,
  },
  selected: {
    backgroundColor: appColors.accentMuted,
    borderColor: appColors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  iconWrapper: {
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textUnselected: {
    color: appColors.textSecondary,
  },
  textSelected: {
    color: appColors.accent,
  },
});
