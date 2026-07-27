import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, Platform } from 'react-native';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function AppInput({
  label,
  error,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  numberOfLines,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          multiline && {
            height: 'auto',
            minHeight: 48,
            paddingVertical: 12,
            alignItems: 'flex-start',
          },
          isFocused && styles.focusedWrapper,
          error && styles.errorWrapper,
          style,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            multiline && {
              height: 'auto',
              minHeight: (numberOfLines || 4) * 20,
              textAlignVertical: 'top',
              paddingTop: 0,
            },
            inputStyle,
          ]}
          placeholderTextColor={appColors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={appColors.accent}
          multiline={multiline}
          numberOfLines={numberOfLines}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: appSpacing.lg,
  },
  label: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: appRadius.button,
    height: 48,
    paddingHorizontal: appSpacing.lg,
  },
  focusedWrapper: {
    borderColor: appColors.accent,
    // Subtle glow — iOS ONLY. On Android with the New Architecture (Fabric),
    // shadow* props are honored (translated to a native shadow) and toggling
    // them when a field gains focus forces the native view to re-layout,
    // which drops focus and bounces the keyboard to a neighbouring input.
    // Under Fabric we must change nothing but borderColor on focus.
    ...Platform.select({
      ios: {
        shadowColor: appColors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
  errorWrapper: {
    borderColor: appColors.danger,
  },
  input: {
    flex: 1,
    color: appColors.textPrimary,
    fontSize: 15,
    height: '100%',
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
  },
  errorText: {
    ...appTypography.metadata,
    color: appColors.danger,
    marginTop: 4,
  },
});
