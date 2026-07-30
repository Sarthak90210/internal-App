import React, { useState, useCallback } from 'react';
import { View, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { QrCode, Folder, Box } from '../lib/lucideIcons';
import QRScannerModal from './QRScannerModal';
import { AppButton, AppModal, AppListItem } from './design-system';
import { TagsService } from '../services/assetTags';
import { InventoryService } from '../services/inventory';
import { decideScanAction } from '../lib/scanResolver';
import { appColors, appRadius, appTypography } from '../theme';

// Reusable, context-aware scan entry point. Drop it into any inventory surface;
// it renders a trigger, the camera scanner, and every follow-up flow (bind
// picker, move-here confirm, navigation, retired/error messaging).
//
//  - surface:        'home' | 'list' | 'folder'  — decides what a scan can do.
//  - containerId:    the list/folder id the user is inside (bind/move target).
//  - bindCandidates: [{ type:'inventory'|'item', id, name }] the entities an
//                    unassigned tag may bind to here (a folder's sub-folders and
//                    items, or a list's folders).
//  - variant:        'fab' | 'button' | 'compact'
export default function InventoryScanButton({
  navigation,
  surface,
  containerId = null,
  allInvs = [],
  bindCandidates = [],
  variant = 'button',
  label = 'Scan',
}) {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [bindState, setBindState] = useState(null); // { code }

  const invName = (id) => allInvs.find((i) => i.id === id)?.name || 'its current location';

  const navigateToEntity = useCallback(
    async (entity) => {
      if (entity.type === 'inventory') {
        const inv = await InventoryService.getInventory(entity.id);
        if (!inv) return Alert.alert('Not found', 'That folder no longer exists.');
        navigation.push('FolderDetail', { inventoryId: inv.id, inventoryName: inv.name });
      } else if (entity.type === 'item') {
        const it = await InventoryService.getItem(entity.id);
        if (!it) return Alert.alert('Not found', 'That item no longer exists.');
        navigation.navigate('ItemDetail', { itemId: it.id, itemData: it });
      }
    },
    [navigation]
  );

  const moveEntityHere = useCallback(
    async (entity) => {
      try {
        if (entity.type === 'item') {
          await InventoryService.updateItem(entity.id, { inventoryId: containerId });
        } else {
          await InventoryService.moveInventory(
            entity.id,
            { type: 'inventory', id: containerId, name: invName(containerId) },
            allInvs
          );
        }
        Alert.alert('Moved', 'The entity now lives here.');
      } catch {
        Alert.alert('Move failed', 'Could not move it here. Please try again.');
      }
    },
    [containerId, allInvs] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleResolved = useCallback(
    async (action) => {
      const { entity, offers } = action;
      if (offers.includes('move')) {
        const label2 = entity.type === 'item' ? 'item' : 'folder';
        // Resolve the entity's CURRENT parent so the prompt is accurate (§6).
        let locationId = null;
        if (entity.type === 'item') {
          locationId = (await InventoryService.getItem(entity.id))?.inventoryId;
        } else {
          locationId = (await InventoryService.getInventory(entity.id))?.parentInventoryId;
        }
        // Already lives here → nothing to move; just open it.
        if (locationId === containerId) return navigateToEntity(entity);

        Alert.alert(
          'Tagged entity',
          `This ${label2} currently sits at "${invName(locationId)}". What would you like to do?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open its page', onPress: () => navigateToEntity(entity) },
            { text: 'Move it here', style: 'destructive', onPress: () => confirmMove(entity, label2) },
          ]
        );
      } else {
        navigateToEntity(entity);
      }
    },
    [navigateToEntity, containerId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const confirmMove = (entity, label2) => {
    Alert.alert('Move here?', `Move this ${label2} into "${invName(containerId)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Move', style: 'destructive', onPress: () => moveEntityHere(entity) },
    ]);
  };

  const handleRetired = async (action) => {
    const superseded = action.supersededBy;
    if (superseded) {
      Alert.alert(
        'Retired label',
        `This label was retired. This asset now uses tag ${superseded}.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Open current tag',
            onPress: async () => {
              const resolved = await TagsService.getByCode(superseded);
              if (resolved.status === 'active') {
                navigateToEntity({ type: resolved.tag.entityType, id: resolved.tag.entityId });
              } else {
                Alert.alert('Unavailable', 'The replacement tag could not be resolved.');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Retired label', 'This label was retired and has no active replacement.');
    }
  };

  const processScan = useCallback(
    async (rawCode) => {
      setScannerVisible(false);
      let resolved;
      try {
        resolved = await TagsService.getByCode(rawCode);
      } catch {
        return Alert.alert('Scan error', 'Could not look up that code. Check your connection.');
      }
      const action = decideScanAction(resolved, { surface, containerId });

      switch (action.kind) {
        case 'error':
          Alert.alert(
            action.reason === 'invalid' ? 'Unreadable code' : 'Unknown tag',
            action.reason === 'invalid'
              ? "That doesn't look like a valid tag code."
              : 'This tag is not in the system yet.'
          );
          break;
        case 'retired':
          handleRetired(action);
          break;
        case 'bind_no_context':
          Alert.alert(
            'Unlinked tag',
            'This tag isn’t linked to anything yet. Open a folder and scan to bind it there.'
          );
          break;
        case 'bind':
          if (bindCandidates.length === 0) {
            Alert.alert('Nothing to bind', 'There are no sub-folders or items here to link this tag to yet.');
          } else {
            setBindState({ code: rawCode });
          }
          break;
        case 'resolved':
          handleResolved(action);
          break;
        default:
          break;
      }
    },
    [surface, containerId, bindCandidates.length, handleResolved] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const doBind = async (candidate) => {
    const code = bindState?.code;
    setBindState(null);
    const res = await TagsService.bindTag({ code, entityType: candidate.type, entityId: candidate.id });
    if (res.ok) {
      Alert.alert('Tag linked', `This tag is now bound to "${candidate.name}".`);
    } else {
      Alert.alert('Could not link', `Binding failed (${res.reason}).`);
    }
  };

  const renderTrigger = () => {
    if (variant === 'compact') {
      return (
        <Pressable onPress={() => setScannerVisible(true)} hitSlop={10} style={styles.compact}>
          <QrCode size={20} color={appColors.textPrimary} />
        </Pressable>
      );
    }
    if (variant === 'fab') {
      return (
        <Pressable onPress={() => setScannerVisible(true)} style={styles.fab}>
          <QrCode size={22} color="#09090B" />
        </Pressable>
      );
    }
    return (
      <AppButton
        variant="secondary"
        size="sm"
        onPress={() => setScannerVisible(true)}
        icon={<QrCode size={14} color={appColors.textPrimary} />}
      >
        {label}
      </AppButton>
    );
  };

  return (
    <>
      {renderTrigger()}

      {/* Mount the camera ONLY while scanning. useCameraPermissions() runs on
          mount and hits the native module, so an always-mounted scanner would
          crash the whole screen on a build that lacks expo-camera. */}
      {scannerVisible && (
        <QRScannerModal
          visible
          onClose={() => setScannerVisible(false)}
          onScan={processScan}
          title="Scan tag"
          subtitle={
            surface === 'folder'
              ? 'Bind, hold, or move — depending on the tag'
              : 'Point at a QR label'
          }
        />
      )}

      <AppModal
        visible={!!bindState}
        onClose={() => setBindState(null)}
        title="Link tag to…"
        scrollable={false}
      >
        <Text style={styles.bindHelper}>Choose which entity here this new tag belongs to.</Text>
        <View style={{ maxHeight: 340 }}>
          <FlatList
            data={bindCandidates}
            keyExtractor={(c) => `${c.type}:${c.id}`}
            renderItem={({ item }) => (
              <AppListItem
                title={item.name || (item.type === 'item' ? 'Unnamed item' : 'Unnamed folder')}
                description={item.type === 'item' ? 'Item' : 'Sub-folder'}
                leftIcon={
                  <View style={styles.candidateIcon}>
                    {item.type === 'item' ? (
                      <Box size={16} color="#A855F7" />
                    ) : (
                      <Folder size={16} color="#38BDF8" />
                    )}
                  </View>
                }
                onPress={() => doBind(item)}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.bindEmpty}>Nothing here to bind to.</Text>
            }
          />
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  compact: { padding: 6 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: appColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  bindHelper: { ...appTypography.body, color: appColors.textSecondary, marginBottom: 12 },
  bindEmpty: { ...appTypography.body, color: appColors.textMuted, textAlign: 'center', padding: 20 },
  candidateIcon: {
    width: 34,
    height: 34,
    borderRadius: appRadius.sm,
    backgroundColor: appColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
