import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { Plus } from '../../lib/lucideIcons';
import { appColors, appRadius, appTypography } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AppFAB({
  onPress,
  icon,
  label,
  style,
  variant = 'accent', // 'accent' | 'surface'
  ...props
}) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isAccent = variant === 'accent';
  const bg = isAccent ? appColors.accent : appColors.elevatedSurface;
  const textColor = isAccent ? '#09090B' : appColors.textPrimary;
  const borderColor = isAccent ? 'transparent' : appColors.border;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.fab,
        { backgroundColor: bg, borderColor },
        label ? styles.fabWithLabel : styles.fabIconOnly,
        animatedStyle,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {icon || <Plus size={20} color={textColor} strokeWidth={2.5} />}
        {label && (
          <Text style={[styles.label, { color: textColor }]}>
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 90, // Floating above bottom nav
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  fabIconOnly: {
    width: 48,
    height: 48,
    borderRadius: appRadius.pill,
  },
  fabWithLabel: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: appRadius.pill,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    ...appTypography.buttonBold,
    marginLeft: 8,
  },
});
