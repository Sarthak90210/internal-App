import React, { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * GlassSurface - React Native adaptation of the web GlassSurface component.
 *
 * Recreates a quiet, translucent glass surface without reflective highlights.
 * Supports 'default' (dark frosted) and 'clear' (crystal transparent) variants.
 *
 * Note: the web original also took blur/brightness/saturation/displace. RN has
 * no backdrop-filter, so those were inert and have been dropped. If real blur
 * is ever needed here, reach for expo-blur rather than re-adding them.
 */
const GlassSurface = forwardRef(({
  children,
  width,
  height,
  borderRadius = 24,
  borderWidth = 1,
  opacity = 0.94,
  backgroundOpacity = 0.08,
  variant = 'default',
  style = {},
  contentContainerStyle = {},
  ...rest
}, ref) => {
  const containerWidth = width ?? '100%';
  const containerHeight = height ?? '100%';

  const isClear = variant === 'clear' || backgroundOpacity > 0.2;

  // Crystal clear glass body vs deep dark frosted surface
  const baseBg = isClear 
    ? 'rgba(255, 255, 255, 0.05)' 
    : `rgba(20, 20, 26, ${opacity})`;

  // Keep the border understated so it does not read as a reflective glare.
  const borderColor = isClear 
    ? 'rgba(255, 255, 255, 0.18)' 
    : 'rgba(255, 255, 255, 0.08)';

  return (
    <View
      ref={ref}
      style={[
        styles.container,
        {
          width: containerWidth,
          height: containerHeight,
          borderRadius: borderRadius,
          borderWidth: borderWidth,
          backgroundColor: baseBg,
          borderColor: borderColor,
        },
        style,
      ]}
      {...rest}
    >
      {/* Content Container */}
      <View style={[styles.content, contentContainerStyle]}>
        {children}
      </View>
    </View>
  );
});

GlassSurface.displayName = 'GlassSurface';

export default GlassSurface;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    // Soft studio shadow per spec
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});
