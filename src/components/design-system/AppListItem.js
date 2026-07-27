import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { ChevronRight, Trash2 } from '../../lib/lucideIcons';
import { Swipeable } from 'react-native-gesture-handler';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function AppListItem({
  title,
  description,
  metadata,
  leftIcon,
  rightElement,
  onPress,
  onDelete,
  style,
  showChevron = true,
  ...props
}) {
  const renderRightActions = () => {
    if (!onDelete) return null;
    return (
      <Pressable onPress={onDelete} style={styles.deleteAction}>
        <Trash2 size={20} color={appColors.textPrimary} />
      </Pressable>
    );
  };

  const content = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && onPress && styles.pressed,
        style,
      ]}
      {...props}
    >
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      
      <View style={styles.copy}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {metadata && <Text style={styles.metadata}>{metadata}</Text>}
        </View>
        
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {rightElement}
        {showChevron && onPress && (
          <ChevronRight size={18} color={appColors.textMuted} style={styles.chevron} />
        )}
      </View>
    </Pressable>
  );

  if (onDelete) {
    return (
      <View style={styles.swipeWrapper}>
        <Swipeable renderRightActions={renderRightActions}>
          {content}
        </Swipeable>
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  swipeWrapper: {
    marginBottom: appSpacing.sm,
    borderRadius: appRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: appColors.border,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    paddingVertical: 14,
    paddingHorizontal: appSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  pressed: {
    backgroundColor: appColors.elevatedSurface,
  },
  leftIcon: {
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...appTypography.body,
    fontWeight: '600',
    flex: 1,
  },
  metadata: {
    ...appTypography.metadata,
    marginLeft: 8,
  },
  description: {
    ...appTypography.caption,
    marginTop: 3,
    color: appColors.textSecondary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  chevron: {
    marginLeft: 6,
  },
  deleteAction: {
    backgroundColor: appColors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: '100%',
  },
});
