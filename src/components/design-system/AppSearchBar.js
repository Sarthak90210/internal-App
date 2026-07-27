import React from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Search, X } from '../../lib/lucideIcons';
import { appColors, appRadius, appSpacing } from '../../theme';

export default function AppSearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onClear,
  style,
  inputStyle,
  ...props
}) {
  const handleClear = () => {
    if (onChangeText) onChangeText('');
    if (onClear) onClear();
  };

  return (
    <View style={[styles.container, style]}>
      <Search size={18} color={appColors.textSecondary} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appColors.textMuted}
        style={[styles.input, inputStyle]}
        selectionColor={appColors.accent}
        {...props}
      />
      {value && value.length > 0 && (
        <Pressable onPress={handleClear} hitSlop={10} style={styles.clearBtn}>
          <X size={18} color={appColors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: appRadius.button,
    height: 44,
    paddingHorizontal: appSpacing.lg,
    marginBottom: appSpacing.lg,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: appColors.textPrimary,
    fontSize: 15,
    height: '100%',
  },
  clearBtn: {
    marginLeft: 8,
    padding: 2,
  },
});
