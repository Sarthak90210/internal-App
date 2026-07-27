import React from 'react';
import { StyleSheet, Text, ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AppButton({
  children,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
  ...props
}) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withTiming(0.98, { duration: 120 });
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withTiming(1, { duration: 120 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getContainerStyles = () => {
    let base = [styles.button];
    if (fullWidth) base.push(styles.fullWidth);

    switch (size) {
      case 'sm':
        base.push(styles.sizeSm);
        break;
      case 'lg':
        base.push(styles.sizeLg);
        break;
      default:
        base.push(styles.sizeMd);
    }

    switch (variant) {
      case 'secondary':
        base.push(styles.secondary);
        break;
      case 'danger':
        base.push(styles.danger);
        break;
      case 'ghost':
        base.push(styles.ghost);
        break;
      default:
        base.push(styles.primary);
    }

    if (disabled) base.push(styles.disabled);
    return base;
  };

  const getTextColor = () => {
    if (disabled) return appColors.textMuted;
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return appColors.textPrimary;
      case 'danger':
        return appColors.danger;
      default:
        return '#09090B'; // Dark text on solid green primary CTA
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[getContainerStyles(), animatedStyle, style]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          {typeof children === 'string' ? (
            <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: appRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: appSpacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  sizeSm: {
    height: 36,
    paddingHorizontal: appSpacing.md,
    borderRadius: appRadius.sm,
  },
  sizeMd: {
    height: 48,
  },
  sizeLg: {
    height: 56,
  },
  primary: {
    backgroundColor: appColors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: appColors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: appColors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: appColors.elevatedSurface,
    borderColor: appColors.border,
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: 8,
  },
  text: {
    ...appTypography.buttonBold,
  },
});
