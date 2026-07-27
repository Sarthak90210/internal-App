import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { ChevronRight, ChevronDown, Folder, ListFilter, Check, Ban, CornerDownRight } from '../lib/lucideIcons';
import { AppModal, AppButton, AppEmptyState } from './design-system';
import { appColors, appRadius, appTypography } from '../theme';

export default function MoveDestinationModal({ visible, onDismiss, onClose, onConfirm, lists = [], inventories = [], allowedTypes = [], invalidTargets = [] }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const handleClose = onClose || onDismiss || (() => {});

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setSelectedTarget(null);
      // Auto-expand all top-level lists by default for a smoother UX
      const initialExpanded = new Set();
      lists.forEach(l => {
        if (!l.isArchived) initialExpanded.add(`list_${l.id}`);
      });
      setExpandedNodes(initialExpanded);
    }
  }, [visible, lists]);

  const toggleExpand = (id) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const isInvalid = (type, id) => {
    if (invalidTargets.includes(`${type}:${id}`)) return true;
    if (type === 'inventory') {
      // Guard against a cycle in parentInventoryId, which would otherwise
      // spin forever on the render thread. Matches the depth cap used in
      // inventorySnapshotService.
      const seen = new Set();
      let current = inventories.find(i => i.id === id);
      let depth = 0;
      while (current && depth < 20 && !seen.has(current.id)) {
        if (invalidTargets.includes(`inventory:${current.id}`)) return true;
        seen.add(current.id);
        current = inventories.find(i => i.id === current.parentInventoryId);
        depth++;
      }
    }
    return false;
  };

  // Build flattened tree for FlatList
  const buildTree = () => {
    const data = [];
    const activeLists = lists.filter(l => !l.isArchived);

    const getChildren = (parentId, level) => {
      const children = inventories.filter(i => i.parentInventoryId === parentId);
      children.forEach(child => {
        const hasChildren = inventories.some(i => i.parentInventoryId === child.id);
        const expanded = expandedNodes.has(`inventory_${child.id}`);
        data.push({ ...child, _nodeType: 'inventory', _level: level, _hasChildren: hasChildren, _expanded: expanded });
        if (expanded && hasChildren) {
          getChildren(child.id, level + 1);
        }
      });
    };

    activeLists.forEach(list => {
      const rootInvs = inventories.filter(i => i.listId === list.id && !i.parentInventoryId);
      const hasChildren = rootInvs.length > 0;
      const expanded = expandedNodes.has(`list_${list.id}`);
      data.push({ ...list, _nodeType: 'list', _level: 0, _hasChildren: hasChildren, _expanded: expanded });
      if (expanded && hasChildren) {
        rootInvs.forEach(inv => {
          const invHasChildren = inventories.some(i => i.parentInventoryId === inv.id);
          const invExpanded = expandedNodes.has(`inventory_${inv.id}`);
          data.push({ ...inv, _nodeType: 'inventory', _level: 1, _hasChildren: invHasChildren, _expanded: invExpanded });
          if (invExpanded && invHasChildren) {
            getChildren(inv.id, 2);
          }
        });
      }
    });

    return data;
  };

  const data = buildTree();

  const renderItem = ({ item }) => {
    const type = item._nodeType;
    const invalid = isInvalid(type, item.id);
    const canSelect = allowedTypes.includes(type);
    const isSelected = selectedTarget?.type === type && selectedTarget?.id === item.id;
    const isList = type === 'list';

    return (
      <Pressable
        onPress={() => {
          if (item._hasChildren) {
            toggleExpand(`${type}_${item.id}`);
          }
          if (!invalid && canSelect) {
            setSelectedTarget({ type, id: item.id, name: item.name });
          }
        }}
        style={[
          styles.nodeRow,
          { paddingLeft: item._level * 20 + 12 },
          isSelected && styles.nodeRowSelected,
          invalid && styles.nodeRowDisabled
        ]}
      >
        <Pressable 
          style={styles.expandIconBox} 
          onPress={(e) => {
            e.stopPropagation();
            if (item._hasChildren) toggleExpand(`${type}_${item.id}`);
          }}
        >
          {item._hasChildren ? (
            item._expanded ? <ChevronDown size={16} color={appColors.textSecondary} /> : <ChevronRight size={16} color={appColors.textSecondary} />
          ) : (
            item._level > 0 ? <CornerDownRight size={14} color={`${appColors.textMuted}50`} /> : null
          )}
        </Pressable>

        <View style={[styles.typeIconBox, isSelected && { backgroundColor: '#8B5CF620', borderColor: '#8B5CF640' }]}>
          {isList ? (
            <ListFilter size={16} color={isSelected ? '#8B5CF6' : appColors.accent} />
          ) : (
            <Folder size={16} color={isSelected ? '#8B5CF6' : '#60A5FA'} />
          )}
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.nodeName, isSelected && { color: '#FFFFFF', ...appTypography.bodyBold }]}>
            {item.name}
          </Text>
          <Text style={styles.nodeSubText}>
            {isList ? 'Inventory List Root' : `Sub-folder${item._hasChildren ? ' • Contains sub-items' : ''}`}
          </Text>
        </View>

        {invalid ? (
          <View style={styles.badgeDisabled}>
            <Ban size={12} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.badgeDisabledText}>Invalid</Text>
          </View>
        ) : isSelected ? (
          <View style={styles.badgeSelected}>
            <Check size={14} color={appColors.background} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Select Destination"
      scrollable={false}
      footer={
        <View style={styles.footerRow}>
          <AppButton 
            variant="ghost" 
            onPress={handleClose} 
            style={{ flex: 1, marginRight: 8 }}
          >
            Cancel
          </AppButton>
          <AppButton 
            variant="primary" 
            disabled={!selectedTarget} 
            onPress={() => onConfirm(selectedTarget)}
            style={{ flex: 1 }}
          >
            Confirm Move
          </AppButton>
        </View>
      }
    >
      <Text style={styles.subtitle}>
        Choose the target list or folder destination where you wish to relocate the selected item(s).
      </Text>

      <View style={styles.treeContainer}>
        {data.length === 0 ? (
          <AppEmptyState
            title="No Valid Destinations"
            description="There are currently no active inventory lists or folders available."
          />
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={data}
            keyExtractor={item => `${item._nodeType}_${item.id}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginBottom: 14,
  },
  treeContainer: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: appRadius.md,
    maxHeight: 380,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 380,
  },
  listContent: {
    paddingVertical: 6,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    borderBottomWidth: 1,
    borderBottomColor: `${appColors.border}40`,
  },
  nodeRowSelected: {
    backgroundColor: `${appColors.accent}15`,
  },
  nodeRowDisabled: {
    opacity: 0.45,
  },
  expandIconBox: {
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: appRadius.sm,
    backgroundColor: appColors.elevatedSurface,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nodeName: {
    ...appTypography.body,
    color: appColors.textPrimary,
  },
  nodeSubText: {
    ...appTypography.caption,
    color: appColors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  badgeSelected: {
    width: 24,
    height: 24,
    borderRadius: appRadius.full,
    backgroundColor: appColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF444415',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: appRadius.sm,
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  badgeDisabledText: {
    ...appTypography.captionBold,
    color: '#EF4444',
    fontSize: 10,
  },
});

