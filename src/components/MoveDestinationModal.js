import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Dialog, Portal, Button, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function MoveDestinationModal({ visible, onDismiss, onConfirm, lists, inventories, allowedTypes, invalidTargets = [] }) {
  const theme = useTheme();
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Reset when opened
  useEffect(() => {
    if (visible) setSelectedTarget(null);
  }, [visible]);

  const toggleExpand = (id) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const isInvalid = (type, id) => {
    if (invalidTargets.includes(`${type}:${id}`)) return true;
    if (type === 'inventory') {
      let current = inventories.find(i => i.id === id);
      while (current) {
        if (invalidTargets.includes(`inventory:${current.id}`)) return true;
        current = inventories.find(i => i.id === current.parentInventoryId);
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

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '80%' }}>
        <Dialog.Title>Select Destination</Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 0 }}>
          <FlatList
            data={data}
            keyExtractor={item => `${item._nodeType}_${item.id}`}
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => {
              const type = item._nodeType;
              const invalid = isInvalid(type, item.id);
              const canSelect = allowedTypes.includes(type);
              const isSelected = selectedTarget?.type === type && selectedTarget?.id === item.id;
              
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
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
                    { paddingLeft: item._level * 20 + 16 },
                    isSelected && { backgroundColor: theme.colors.primaryContainer },
                    invalid && { opacity: 0.5 }
                  ]}
                >
                  <View style={{ width: 24, alignItems: 'center' }}>
                    {item._hasChildren && (
                      <MaterialCommunityIcons 
                        name={item._expanded ? "chevron-down" : "chevron-right"} 
                        size={20} 
                        color={theme.colors.onSurfaceVariant} 
                        onPress={() => toggleExpand(`${type}_${item.id}`)}
                      />
                    )}
                  </View>
                  <MaterialCommunityIcons 
                    name={type === 'list' ? 'format-list-bulleted-type' : 'folder'} 
                    size={18} 
                    color={type === 'list' ? theme.colors.primary : theme.colors.secondary} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ flex: 1, fontWeight: isSelected ? 'bold' : 'normal' }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button 
            disabled={!selectedTarget} 
            onPress={() => onConfirm(selectedTarget)}
          >
            Confirm
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 16
  }
});
