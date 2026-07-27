import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Inbox } from '../../lib/lucideIcons';
import { appColors, appSpacing, appTypography } from '../../theme';
import AppButton from './AppButton';

export default function AppEmptyState({
  icon,
  title = "No items found",
  // `description` is the prop every call site uses; `message` is kept as an
  // alias so older usages keep working.
  description,
  message,
  actionLabel,
  onAction,
  style,
  ...props
}) {
  const body = description ?? message ?? "There is nothing to display here yet.";

  return (
    <View style={[styles.container, style]} {...props}>
      <View style={styles.iconWrapper}>
        {icon || <Inbox size={42} color={appColors.textMuted} strokeWidth={1.5} />}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{body}</Text>

      {actionLabel && onAction && (
        <View style={styles.actionWrapper}>
          <AppButton variant="secondary" size="sm" onPress={onAction}>
            {actionLabel}
          </AppButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: appSpacing.xl,
  },
  title: {
    ...appTypography.cardTitle,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    ...appTypography.caption,
    color: appColors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  actionWrapper: {
    marginTop: 20,
  },
});
