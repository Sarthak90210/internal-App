import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronRight } from '../../lib/lucideIcons';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function AppSection({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
  rightElement,
  style,
  contentStyle,
  ...props
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpand = () => {
    if (collapsible) {
      setExpanded(!expanded);
    }
  };

  return (
    <View style={[styles.container, style]} {...props}>
      {(title || subtitle || rightElement) && (
        collapsible ? (
          <Pressable
            onPress={toggleExpand}
            style={styles.header}
          >
            <View style={styles.titleWrapper}>
              <View style={styles.chevron}>
                {expanded ? (
                  <ChevronDown size={18} color={appColors.textSecondary} />
                ) : (
                  <ChevronRight size={18} color={appColors.textSecondary} />
                )}
              </View>
              <View>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            </View>
            {rightElement && <View style={styles.right}>{rightElement}</View>}
          </Pressable>
        ) : (
          <View style={styles.header}>
            <View style={styles.titleWrapper}>
              <View>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            </View>
            {rightElement && <View style={styles.right}>{rightElement}</View>}
          </View>
        )
      )}
      {(!collapsible || expanded) && (
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: appSpacing.section,
    backgroundColor: appColors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: appSpacing.xl,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    backgroundColor: appColors.elevatedSurface,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevron: {
    marginRight: 8,
  },
  title: {
    ...appTypography.sectionTitle,
    fontSize: 17,
  },
  subtitle: {
    ...appTypography.caption,
    marginTop: 2,
  },
  right: {
    marginLeft: 12,
  },
  content: {
    padding: appSpacing.xl,
  },
});
