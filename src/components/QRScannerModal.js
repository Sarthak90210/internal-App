import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Modal, StyleSheet, Pressable, Platform, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Flashlight, Keyboard as KeyboardIcon, QrCode } from '../lib/lucideIcons';
import { AppButton, AppInput } from './design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../theme';
import { normalizeCode, isValidCode } from '../lib/shortCode';

// Full-screen QR scanner. Emits the RAW scanned string via onScan — callers
// resolve it through TagsService.getByCode. Includes a manual-entry fallback so
// a scratched/soaked label can still be typed in (codes are human-readable by
// design).
//
// NOTE: this component imports expo-camera, a native module. The first build
// that ships this MUST be a fresh binary — it cannot be delivered as an OTA
// update (see lib/lucideIcons.js for the incident this rule comes from).
export default function QRScannerModal({
  visible,
  onClose,
  onScan,
  title = 'Scan a tag',
  subtitle = 'Point the camera at a QR label',
}) {
  const insets = useSafeAreaInsets();
  // Inside a RN Modal, insets can read 0 on Android — fall back to the real
  // status-bar height so the header never sits under the clock/notch.
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20);
  const bottomInset = Math.max(insets.bottom, 16);

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  // Latch so a single QR under the camera fires onScan exactly once, not on
  // every frame. Re-armed each time the modal is (re)opened.
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setTorch(false);
      setManualMode(false);
      setManualCode('');
    }
  }, [visible]);

  const handleBarcode = useCallback(
    ({ data }) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      onScan?.(data);
    },
    [onScan]
  );

  const submitManual = () => {
    const code = normalizeCode(manualCode);
    onScan?.(code);
  };

  const manualValid = isValidCode(manualCode);

  const renderBody = () => {
    // Permission still loading.
    if (!permission) {
      return (
        <View style={styles.centered}>
          <Text style={styles.infoText}>Preparing camera…</Text>
        </View>
      );
    }

    // Permission not granted yet.
    if (!permission.granted) {
      return (
        <View style={styles.centered}>
          <QrCode size={48} color={appColors.textSecondary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.infoText}>
            {permission.canAskAgain
              ? 'Allow camera access to scan QR tags.'
              : 'Camera permission is disabled. Enable it in system settings to scan.'}
          </Text>
          {permission.canAskAgain && (
            <AppButton variant="primary" onPress={requestPermission} style={{ marginTop: appSpacing.lg }}>
              Grant Camera Access
            </AppButton>
          )}
          <AppButton
            variant="secondary"
            onPress={() => setManualMode(true)}
            style={{ marginTop: appSpacing.md }}
            icon={<KeyboardIcon size={16} color={appColors.textPrimary} />}
          >
            Enter code manually
          </AppButton>
        </View>
      );
    }

    // Manual entry mode.
    if (manualMode) {
      return (
        <View style={styles.manualWrap}>
          <Text style={styles.permTitle}>Enter tag code</Text>
          <Text style={styles.infoText}>Type the code printed under the QR.</Text>
          <AppInput
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="e.g. K7M2QX90"
            autoCapitalize="characters"
            autoFocus
            style={{ marginTop: appSpacing.lg }}
          />
          {manualCode.length > 0 && !manualValid && (
            <Text style={styles.invalidHint}>Code looks incomplete or mistyped.</Text>
          )}
          <View style={styles.manualActions}>
            <AppButton variant="ghost" onPress={() => setManualMode(false)} style={{ flex: 1, marginRight: 8 }}>
              Back to scanner
            </AppButton>
            <AppButton variant="primary" onPress={submitManual} disabled={!manualValid} style={{ flex: 1 }}>
              Look up
            </AppButton>
          </View>
        </View>
      );
    }

    // Live camera.
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcode}
        />
        {/* Reticle overlay */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.reticleHint}>{subtitle}</Text>
        </View>
        {/* Bottom controls */}
        <View style={[styles.controls, { bottom: bottomInset + 24 }]}>
          <Pressable style={styles.controlBtn} onPress={() => setTorch((t) => !t)} hitSlop={12}>
            <Flashlight size={22} color={torch ? appColors.accent : '#FFFFFF'} />
            <Text style={styles.controlLabel}>Torch</Text>
          </Pressable>
          <Pressable style={styles.controlBtn} onPress={() => setManualMode(true)} hitSlop={12}>
            <KeyboardIcon size={22} color="#FFFFFF" />
            <Text style={styles.controlLabel}>Enter code</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset + 8 }]}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        {renderBody()}
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
    zIndex: 2,
  },
  title: { ...appTypography.sectionTitle, fontSize: 18, color: '#FFFFFF' },
  closeBtn: { padding: 4 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: appSpacing.xl,
    backgroundColor: appColors.background,
  },
  permTitle: {
    ...appTypography.sectionTitle,
    fontSize: 18,
    color: appColors.textPrimary,
    marginTop: appSpacing.md,
    textAlign: 'center',
  },
  infoText: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  cameraWrap: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: appRadius.lg,
    backgroundColor: 'transparent',
  },
  reticleHint: {
    ...appTypography.body,
    color: '#FFFFFF',
    marginTop: appSpacing.lg,
    textAlign: 'center',
    paddingHorizontal: appSpacing.xl,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
  },
  controlBtn: { alignItems: 'center' },
  controlLabel: { ...appTypography.caption, color: '#FFFFFF', marginTop: 6 },
  manualWrap: {
    flex: 1,
    paddingHorizontal: appSpacing.xl,
    paddingTop: appSpacing.xxl || 40,
    backgroundColor: appColors.background,
  },
  manualActions: { flexDirection: 'row', marginTop: appSpacing.xl },
  invalidHint: { ...appTypography.caption, color: '#F59E0B', marginTop: 8 },
});
