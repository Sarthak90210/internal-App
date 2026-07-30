import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Modal, StyleSheet, Pressable, Platform, StatusBar, FlatList, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Box, Folder, Check } from '../lib/lucideIcons';
import { AppButton } from './design-system';
import { TagsService } from '../services/assetTags';
import { InventoryService } from '../services/inventory';
import { appColors, appRadius, appSpacing, appTypography } from '../theme';

// Bulk scan (spec Rec 5): scan many tags in a row, stage the resolved entities,
// then commit all the moves into the current container in one go — the
// difference between a 40-minute stock-take and a 4-minute one.
//
// This is a distinct UX from the single-shot QRScannerModal (it keeps the camera
// live and accumulates), so it owns its own CameraView.
export default function BulkScanModal({ visible, onClose, containerId, containerName, allInvs = [] }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20);
  const bottomInset = Math.max(insets.bottom, 12);

  const [permission, requestPermission] = useCameraPermissions();
  const [staged, setStaged] = useState([]); // [{ type, id, name }]
  const [skipped, setSkipped] = useState(0);
  const [committing, setCommitting] = useState(false);
  // Throttle: ignore repeats of the same code within a window, and any scan
  // within a short cooldown, so one label doesn't stage twice.
  const lastScan = useRef({ code: null, at: 0 });

  useEffect(() => {
    if (visible) {
      setStaged([]);
      setSkipped(0);
      lastScan.current = { code: null, at: 0 };
    }
  }, [visible]);

  const onBarcode = useCallback(
    async ({ data }) => {
      const now = Date.now();
      if (data === lastScan.current.code && now - lastScan.current.at < 3000) return;
      if (now - lastScan.current.at < 700) return;
      lastScan.current = { code: data, at: now };

      const resolved = await TagsService.getByCode(data).catch(() => ({ status: 'error' }));
      if (resolved.status !== 'active') {
        setSkipped((s) => s + 1);
        return;
      }
      const entity = { type: resolved.tag.entityType, id: resolved.tag.entityId };
      // Don't stage the container itself or duplicates.
      if (entity.id === containerId) return;
      setStaged((prev) => {
        if (prev.some((e) => e.id === entity.id)) return prev;
        return [...prev, { ...entity, name: '…' }];
      });
      // Resolve a display name without blocking the camera.
      const doc = entity.type === 'item'
        ? await InventoryService.getItem(entity.id)
        : await InventoryService.getInventory(entity.id);
      setStaged((prev) => prev.map((e) => (e.id === entity.id ? { ...e, name: doc?.name || e.id } : e)));
    },
    [containerId]
  );

  const removeStaged = (id) => setStaged((prev) => prev.filter((e) => e.id !== id));

  const commit = async () => {
    if (staged.length === 0) return;
    try {
      setCommitting(true);
      await Promise.all(
        staged.map((e) =>
          e.type === 'item'
            ? InventoryService.updateItem(e.id, { inventoryId: containerId })
            : InventoryService.moveInventory(e.id, { type: 'inventory', id: containerId, name: containerName }, allInvs)
        )
      );
      Alert.alert('Stock-take committed', `Moved ${staged.length} item${staged.length === 1 ? '' : 's'} into "${containerName}".`);
      onClose?.();
    } catch (error) {
      console.error('Bulk commit failed:', error);
      Alert.alert('Commit failed', 'Some moves could not be saved. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  const canScan = permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset + 8 }]}>
          <Text style={styles.title}>Bulk scan → {containerName}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}><Text style={styles.info}>Preparing camera…</Text></View>
        ) : !canScan ? (
          <View style={styles.center}>
            <Text style={styles.info}>Camera access is needed to bulk scan.</Text>
            {permission.canAskAgain && (
              <AppButton variant="primary" onPress={requestPermission} style={{ marginTop: 16 }}>
                Grant Camera Access
              </AppButton>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onBarcode}
            />
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>
                {staged.length} staged{skipped > 0 ? ` · ${skipped} skipped` : ''}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.tray, { paddingBottom: bottomInset + appSpacing.lg }]}>
          <FlatList
            data={staged}
            keyExtractor={(e) => e.id}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <View style={styles.stagedRow}>
                {item.type === 'item' ? <Box size={16} color="#A855F7" /> : <Folder size={16} color="#38BDF8" />}
                <Text style={styles.stagedName} numberOfLines={1}>{item.name}</Text>
                <Pressable onPress={() => removeStaged(item.id)} hitSlop={10}>
                  <X size={16} color={appColors.textMuted} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyTray}>Scan tags to stage them here.</Text>}
          />
          <AppButton
            variant="primary"
            onPress={commit}
            loading={committing}
            disabled={staged.length === 0}
            icon={<Check size={16} color="#09090B" />}
            style={{ marginTop: 12 }}
          >
            {staged.length > 0 ? `Move ${staged.length} here` : 'Nothing staged'}
          </AppButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: appSpacing.xl,
    paddingBottom: appSpacing.md,
  },
  title: { ...appTypography.sectionTitle, fontSize: 16, color: '#FFFFFF', flex: 1, marginRight: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: appSpacing.xl },
  info: { ...appTypography.body, color: '#FFFFFF', textAlign: 'center' },
  cameraWrap: { flex: 1 },
  camera: { ...StyleSheet.absoluteFillObject },
  counterPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: appRadius.pill,
  },
  counterText: { ...appTypography.bodyBold, color: '#FFFFFF' },
  tray: {
    backgroundColor: appColors.background,
    padding: appSpacing.lg,
    borderTopLeftRadius: appRadius.lg,
    borderTopRightRadius: appRadius.lg,
  },
  stagedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  stagedName: { ...appTypography.body, color: appColors.textPrimary, flex: 1 },
  emptyTray: { ...appTypography.body, color: appColors.textMuted, textAlign: 'center', paddingVertical: 16 },
});
