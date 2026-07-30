import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import QRScannerModal from './QRScannerModal';
import { TagsService } from '../services/assetTags';

// Focused "attach/replace a QR for THIS entity" flow. Used right after creating
// a folder/sub-folder/item (spec §4, mode 'attach') and to re-tag an entity whose
// label was destroyed (spec §2, mode 'replace' → old tag retired, new one bound).
// Unlike InventoryScanButton it targets a known entity — no candidate picker.
//
// entity: { type: 'inventory' | 'item', id, name }
export default function AttachTagModal({ visible, onClose, entity, mode = 'attach' }) {
  const onScan = useCallback(
    async (rawCode) => {
      onClose?.();
      if (!entity?.id) return;

      let resolved;
      try {
        resolved = await TagsService.getByCode(rawCode);
      } catch {
        return Alert.alert('Scan error', 'Could not look up that code. Check your connection.');
      }

      switch (resolved.status) {
        case 'invalid':
          return Alert.alert('Unreadable code', "That doesn't look like a valid tag.");
        case 'not_found':
          return Alert.alert('Unknown tag', 'This tag is not in the system yet.');
        case 'active':
          return Alert.alert('Already in use', 'That tag is already bound to something else.');
        case 'retired':
          return Alert.alert('Retired tag', 'That tag has been retired and can’t be reused.');
        case 'unassigned': {
          const res =
            mode === 'replace'
              ? await TagsService.retireAndReissue({ entityType: entity.type, entityId: entity.id, newCode: rawCode })
              : await TagsService.bindTag({ code: rawCode, entityType: entity.type, entityId: entity.id });
          if (res.ok) {
            Alert.alert(
              mode === 'replace' ? 'Tag replaced' : 'Tag attached',
              mode === 'replace'
                ? `"${entity.name}" now uses the new tag. The old label is retired.`
                : `"${entity.name}" is now linked to this tag.`
            );
          } else {
            Alert.alert('Could not complete', `Operation failed (${res.reason}).`);
          }
          return undefined;
        }
        default:
          return undefined;
      }
    },
    [entity, onClose, mode]
  );

  // Only mount the camera-backed scanner while open — useCameraPermissions()
  // touches the native module on mount and would crash a screen on a build
  // without expo-camera if left permanently mounted.
  if (!visible) return null;

  return (
    <QRScannerModal
      visible
      onClose={onClose}
      onScan={onScan}
      title={mode === 'replace' ? `Replace tag for ${entity?.name || 'entity'}` : `Attach tag to ${entity?.name || 'new entity'}`}
      subtitle="Scan an unused QR label"
    />
  );
}
