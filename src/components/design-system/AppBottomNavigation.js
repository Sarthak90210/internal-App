import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Layers, ShieldAlert, User } from '../../lib/lucideIcons';
import { appColors } from '../../theme';
import GlassSurface from './GlassSurface';

const { width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48 - 12) / 3; // Horizontal padding 24*2 + inner padding 6*2

// Keep the indicator responsive without making it oscillate past its target.
// This is intentionally close to critical damping: a liquid element settles
// quickly, but still carries a little momentum into its destination.
const POSITION_SPRING = {
  damping: 28,
  stiffness: 260,
  mass: 0.75,
  overshootClamping: true,
};

const SHAPE_SPRING = {
  damping: 24,
  stiffness: 280,
  mass: 0.55,
  overshootClamping: true,
};

export default function AppBottomNavigation({ state, navigation }) {
  const indicatorX = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const startX = useSharedValue(0);

  useEffect(() => {
    const targetX = state.index * TAB_WIDTH;
    const distance = Math.abs(targetX - indicatorX.value);

    if (distance <= 1) {
      indicatorX.value = targetX;
      return;
    }

    // A fast tab change pulls the liquid in the direction of travel before it
    // relaxes. The deformation is tied to distance, rather than an arbitrary
    // timer, so it scales naturally across different screen sizes.
    const travelRatio = Math.min(1, distance / TAB_WIDTH);
    // Apple-like liquid glass briefly blooms as it travels: it gets wider
    // and slightly taller, then surface tension pulls it back to its resting
    // size at the destination.
    const bloomX = 1.14 + travelRatio * 0.1;
    const bloomY = 1.06 + travelRatio * 0.04;

    scaleX.value = withSequence(
      withSpring(bloomX, SHAPE_SPRING),
      withSpring(1, SHAPE_SPRING)
    );
    scaleY.value = withSequence(
      withSpring(bloomY, SHAPE_SPRING),
      withSpring(1, SHAPE_SPRING)
    );
    indicatorX.value = withSpring(targetX, POSITION_SPRING);
  }, [state.index, indicatorX, scaleX, scaleY]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorX.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  const switchTab = (index) => {
    const route = state.routes[index];
    if (route && state.index !== index) {
      navigation.navigate({ name: route.name, merge: true });
    }
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      startX.value = indicatorX.value;

      // Stop any previous travel before the user's finger takes control.
      cancelAnimation(indicatorX);
      cancelAnimation(scaleX);
      cancelAnimation(scaleY);
    })
    .onUpdate((event) => {
      // Interactive dragging anywhere left or right across the nav bar
      const newX = startX.value + event.translationX;
      const maxOffset = (state.routes.length - 1) * TAB_WIDTH;
      indicatorX.value = Math.max(0, Math.min(newX, maxOffset));

      // Keep a visible bloom while the pill is under the finger, then add
      // directional stretch from velocity as it moves between tabs.
      const speed = Math.min(Math.abs(event.velocityX), 1800);
      const speedRatio = speed / 1800;
      scaleX.value = 1.1 + speedRatio * 0.2;
      scaleY.value = 1.04 + speedRatio * 0.05;
    })
    .onFinalize((event) => {
      isDragging.value = false;

      // Let release velocity carry the pill a short distance before choosing
      // the destination. This makes a quick swipe feel fluid without skipping
      // several tabs by accident.
      const projectedX = indicatorX.value + event.velocityX * 0.12;
      const targetIndex = Math.round(projectedX / TAB_WIDTH);
      const clampedIndex = Math.max(0, Math.min(targetIndex, state.routes.length - 1));
      const targetX = clampedIndex * TAB_WIDTH;

      // Surface tension restores the resting shape as the position spring
      // carries the pill into the selected slot.
      scaleX.value = withSpring(1, SHAPE_SPRING);
      scaleY.value = withSpring(1, SHAPE_SPRING);

      indicatorX.value = withSpring(targetX, {
        ...POSITION_SPRING,
        velocity: event.velocityX,
      });

      // Switch tab on JS thread
      runOnJS(switchTab)(clampedIndex);
    });

  const getIcon = (routeName, isFocused) => {
    const color = isFocused ? appColors.accent : appColors.textMuted;
    const size = 22;
    switch (routeName) {
      case 'InventoryTab':
        return <Layers size={size} color={color} strokeWidth={isFocused ? 2.5 : 1.8} />;
      case 'AdminTab':
        return <ShieldAlert size={size} color={color} strokeWidth={isFocused ? 2.5 : 1.8} />;
      case 'ProfileTab':
        return <User size={size} color={color} strokeWidth={isFocused ? 2.5 : 1.8} />;
      default:
        return <Layers size={size} color={color} />;
    }
  };

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={{ width: '100%' }}>
          <GlassSurface
            width="100%"
            height={62}
            borderRadius={31}
            variant="default"
            style={styles.container}
            contentContainerStyle={styles.navContent}
          >
            <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
              <GlassSurface
                width="100%"
                height="100%"
                borderRadius={25}
                variant="clear"
                borderWidth={1.2}
                style={styles.pillSurface}
              />
            </Animated.View>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate({ name: route.name, merge: true });
                }
              };

              const onPressIn = () => {
                if (!isDragging.value) {
                  // The selection lens visibly blooms on touch, then returns
                  // to its normal size when the press is released.
                  scaleX.value = withSpring(1.12, SHAPE_SPRING);
                  scaleY.value = withSpring(1.06, SHAPE_SPRING);
                }
              };

              const onPressOut = () => {
                if (!isDragging.value) {
                  scaleX.value = withSpring(1, SHAPE_SPRING);
                  scaleY.value = withSpring(1, SHAPE_SPRING);
                }
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  style={styles.tabItem}
                  hitSlop={10}
                >
                  {getIcon(route.name, isFocused)}
                </Pressable>
              );
            })}
          </GlassSurface>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    width: '100%',
    height: 62,
    // Soft shadow per spec
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  navContent: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItem: {
    width: TAB_WIDTH,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  indicatorWrapper: {
    position: 'absolute',
    left: 6,
    width: TAB_WIDTH,
    height: 50,
    zIndex: 1,
  },
  pillSurface: {
    width: '100%',
    height: '100%',
  },
});
