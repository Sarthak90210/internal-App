import React from 'react';
import { View, Modal, StyleSheet, Pressable, Text, ScrollView, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from '../../lib/lucideIcons';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      {...props}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        
        <View style={[styles.sheet, { maxHeight }, style]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.border,
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
