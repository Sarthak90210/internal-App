import React, { useEffect } from 'react';
import { View, Modal, StyleSheet, Pressable, Text, ScrollView, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { X } from '../../lib/lucideIcons';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// A sheet can be pulled up to nearly full-screen, and flicked/dragged down to
// dismiss. Kept a touch below the very top so the status bar stays clear.
const EXPANDED_MAX = SCREEN_HEIGHT * 0.94;
const DISMISS_THRESHOLD = 120; // px dragged down past which release closes the sheet
const SPRING = { damping: 22, stiffness: 240, mass: 0.7 };

export default function AppModal({
  visible = false,
  onClose,
  title,
  children,
  maxHeight = SCREEN_HEIGHT * 0.85,
  footer,
  style,
  // Set false when the content already provides its own vertical scrolling
  // (e.g. a FlatList). Nesting a VirtualizedList inside this ScrollView breaks
  // windowing and logs a warning, so we render children in a plain View then.
  scrollable = true,
  ...props
}) {
  // drag > 0  → pulled up: the height cap grows past `maxHeight` toward EXPANDED_MAX.
  // drag < 0  → pulled down: the whole sheet slides down; released far enough, it closes.
  const drag = useSharedValue(0);
  const startDrag = useSharedValue(0);

  // Reset the pulled state whenever the sheet closes so it reopens at rest.
  useEffect(() => {
    if (!visible) drag.value = 0;
  }, [visible, drag]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startDrag.value = drag.value;
    })
    .onUpdate((e) => {
      // Dragging up (negative translationY) grows the sheet; dragging down shrinks it.
      drag.value = startDrag.value - e.translationY;
    })
    .onEnd((e) => {
      if (drag.value < -DISMISS_THRESHOLD || e.velocityY > 1000) {
        drag.value = 0;
        if (onClose) runOnJS(onClose)();
        return;
      }
      // Snap: never below rest (0), never taller than the expanded cap allows.
      const maxUp = EXPANDED_MAX - maxHeight;
      let next = drag.value;
      if (next < 0) next = 0;
      if (next > maxUp) next = maxUp;
      drag.value = withSpring(next, SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => {
    const d = drag.value;
    // Only the maximum height is animated — the sheet still sizes to its content
    // at rest, so short modals are unaffected. Pulling up raises the cap, which
    // lets tall/scrolling content (e.g. a member list) reveal more.
    const cap = maxHeight + (d > 0 ? d : 0);
    return {
      maxHeight: cap > EXPANDED_MAX ? EXPANDED_MAX : cap,
      transform: [{ translateY: d < 0 ? -d : 0 }],
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      {...props}
    >
      {/* react-native-gesture-handler needs its own root inside an RN Modal,
          otherwise the pan on the handle never fires (notably on Android). */}
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={styles.dismissArea} onPress={onClose} />

          <Animated.View style={[styles.sheet, sheetStyle, style]}>
            <GestureDetector gesture={pan}>
              {/* The grab area: the visible pill plus generous padding so it's
                  easy to catch with a thumb. */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>

            {title && (
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {onClose && (
                  <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                    <X size={20} color={appColors.textSecondary} />
                  </Pressable>
                )}
              </View>
            )}

            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                // Without this, when the keyboard is open the first tap on another
                // field is swallowed by the keyboard-dismiss gesture instead of
                // focusing the field you tapped — which reads as focus jumping to
                // the wrong input. "handled" lets taps reach children directly.
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.body, styles.bodyContent]}>
                {children}
              </View>
            )}

            {footer && <View style={styles.footer}>{footer}</View>}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: appColors.backdrop,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: appColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: appColors.border,
    borderBottomWidth: 0,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: appSpacing.xxl,
    paddingBottom: appSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  title: {
    ...appTypography.sectionTitle,
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: appSpacing.xxl,
  },
  footer: {
    paddingHorizontal: appSpacing.xxl,
    paddingVertical: appSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
    backgroundColor: appColors.elevatedSurface,
  },
});
