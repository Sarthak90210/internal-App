import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { QrCode, Download, Plus } from '../../lib/lucideIcons';
import { TagsService } from '../../services/assetTags';
import { exportTagsSheet } from '../../services/tagExport';
import { useAuthStore } from '../../stores/authStore';
import {
  AppCard,
  AppSection,
  AppButton,
  AppInput,
  AppBadge,
  AppSkeleton,
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function ManageTagsScreen() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('inventory');

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countText, setCountText] = useState('50');
  const [minting, setMinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastMinted, setLastMinted] = useState([]);

  useEffect(() => {
    const unsub = TagsService.subscribeToTags((data) => {
      setTags(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const c = { total: tags.length, unassigned: 0, active: 0, retired: 0 };
    for (const t of tags) {
      if (t.status === 'active') c.active++;
      else if (t.status === 'retired') c.retired++;
      else c.unassigned++;
    }
    return c;
  }, [tags]);

  const handleMint = async () => {
    const count = parseInt(countText, 10);
    if (!Number.isFinite(count) || count < 1) {
      return Alert.alert('Invalid amount', 'Enter how many tags to generate (1 or more).');
    }
    if (count > 500) {
      return Alert.alert('Too many at once', 'Generate at most 500 tags per batch.');
    }
    try {
      setMinting(true);
      const codes = await TagsService.mintBatch(count);
      setLastMinted(codes);
      Alert.alert(
        'Tags generated',
        `${codes.length} new tag${codes.length === 1 ? '' : 's'} created. Export the sheet to print them.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Export now', onPress: () => handleExport(codes) },
        ]
      );
    } catch (error) {
      console.error('Error minting tags:', error);
      Alert.alert('Error', 'Could not generate tags. Please try again.');
    } finally {
      setMinting(false);
    }
  };

  const handleExport = async (codes) => {
    try {
      setExporting(true);
      await exportTagsSheet(codes);
    } catch (error) {
      console.error('Error exporting tags:', error);
      Alert.alert('Export failed', error.message || 'Could not export the tag sheet.');
    } finally {
      setExporting(false);
    }
  };

  const exportUnassigned = () => {
    const codes = tags.filter((t) => (t.status || 'unassigned') === 'unassigned').map((t) => t.id);
    if (codes.length === 0) return Alert.alert('Nothing to export', 'There are no unassigned tags.');
    handleExport(codes);
  };

  if (!canManage) {
    return (
      <View style={styles.centered}>
        <QrCode size={40} color={appColors.textMuted} />
        <Text style={styles.deniedText}>You need inventory permission to manage tags.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <AppSection title="Tag Inventory">
        {loading ? (
          <AppSkeleton width="100%" height={90} />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{counts.unassigned}</Text>
              <Text style={styles.statLabel}>Unassigned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{counts.active}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: appColors.textMuted }]}>{counts.retired}</Text>
              <Text style={styles.statLabel}>Retired</Text>
            </View>
          </View>
        )}
      </AppSection>

      <AppSection title="Generate New Tags" style={{ marginTop: appSpacing.xl }}>
        <AppCard variant="elevated" style={{ padding: appSpacing.lg }}>
          <Text style={styles.helper}>
            Print these before sticking them on anything. Each tag starts unassigned and is bound when first scanned inside a folder.
          </Text>
          <AppInput
            label="How many?"
            value={countText}
            onChangeText={setCountText}
            keyboardType="numeric"
            placeholder="50"
            style={{ marginTop: 12 }}
          />
          <AppButton
            variant="primary"
            onPress={handleMint}
            loading={minting}
            icon={<Plus size={16} color="#09090B" />}
            style={{ marginTop: 16 }}
          >
            Generate Tags
          </AppButton>
        </AppCard>
      </AppSection>

      <AppSection title="Export for Printing" style={{ marginTop: appSpacing.xl }}>
        <AppCard variant="surface" style={{ padding: appSpacing.lg }}>
          {lastMinted.length > 0 && (
            <View style={styles.lastMintedRow}>
              <AppBadge variant="success">{lastMinted.length} just generated</AppBadge>
              <AppButton
                variant="secondary"
                size="sm"
                onPress={() => handleExport(lastMinted)}
                loading={exporting}
                icon={<Download size={14} color={appColors.textPrimary} />}
              >
                Export last batch
              </AppButton>
            </View>
          )}
          <AppButton
            variant="secondary"
            onPress={exportUnassigned}
            loading={exporting}
            icon={<Download size={16} color={appColors.textPrimary} />}
            style={{ marginTop: lastMinted.length > 0 ? 12 : 0 }}
          >
            {`Export all unassigned (${counts.unassigned})`}
          </AppButton>
        </AppCard>
      </AppSection>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: appColors.background },
  content: { padding: appSpacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: appSpacing.xl, backgroundColor: appColors.background },
  deniedText: { ...appTypography.body, color: appColors.textSecondary, textAlign: 'center', marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: appRadius.md,
    padding: appSpacing.lg,
    alignItems: 'center',
  },
  statValue: { ...appTypography.title, fontSize: 26, color: appColors.textPrimary },
  statLabel: { ...appTypography.caption, color: appColors.textSecondary, marginTop: 4 },
  helper: { ...appTypography.body, color: appColors.textSecondary },
  lastMintedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
