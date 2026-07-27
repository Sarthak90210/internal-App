import React, { useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { appColors, appRadius, appSpacing } from '../../theme';

export default function AppCard({
  children,
  style,
  onPress,
  // `variant` ('surface' | 'elevated') is what the screens actually pass;
  // `elevated` is the original boolean. Either works, variant wins.
  variant,
  elevated = false,
  animate = true,
  contentStyle,
  ...props
}) {
  const isElevated = variant ? variant === 'elevated' : elevated;

  const opacity = useSharedValue(animate ? 0 : 1);
  const translateY = useSharedValue(animate ? 6 : 0);

  useEffect(() => {
    if (animate) {
      opacity.value = withTiming(1, { 
        duration: 200, 
        easing: Easing.out(Easing.cubic) 
      });
      translateY.value = withTiming(0, { 
        duration: 200, 
        easing: Easing.out(Easing.cubic) 
      });
    }
  }, [animate, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const bg = isElevated ? appColors.elevatedSurface : appColors.surface;

  if (onPress) {
    return (
      <Animated.View style={[styles.wrapper, animatedStyle, style]} {...props}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: bg },
            pressed && styles.pressed,
            contentStyle,
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.wrapper, 
        styles.card, 
        { backgroundColor: bg }, 
        animatedStyle, 
        contentStyle, 
        style
      ]} 
      {...props}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: appRadius.card,
    marginBottom: appSpacing.lg,
  },
  card: {
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: appColors.border,
    padding: appSpacing.xl,
    // Very subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
    backgroundColor: appColors.elevatedSurface,
  },
});
