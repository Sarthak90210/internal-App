import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Download, FileText, Table, Layers, CheckCircle2, AlertCircle, CheckSquare, Square } from '../lib/lucideIcons';
import { exportToCsv, exportToExcel, getExportScopes } from '../services/inventoryExportService';
import { AppModal, AppButton, AppSection } from './design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../theme';

export default function ExportModal({ visible, onDismiss, onClose, listId, inventoryId }) {
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleClose = onClose || onDismiss || (() => {});
  const scopes = getExportScopes(listId, inventoryId);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const selectedScope = scopes.find(s => s.key === scope) || scopes[0];
      const exportFn = format === 'csv' ? exportToCsv : exportToExcel;
      const suffix = format === 'csv' ? '' : '_Excel';
      const fileName = `TRFPV_Inventory_${scope}${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await exportFn(selectedScope.filter, fileName);
      
      if (res.success) {
        setResult({ type: 'success', message: `Exported ${res.itemCount} items successfully!` });
        setTimeout(() => {
          handleClose();
          setResult(null);
        }, 1500);
      } else {
        setResult({ type: 'error', message: res.error || 'Export failed to generate file.' });
      }
    } catch (error) {
      setResult({ type: 'error', message: error.message || 'An unexpected error occurred during export.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Export Inventory Data"
      footer={
        <View style={styles.footerRow}>
          <AppButton 
            variant="ghost" 
            onPress={handleClose} 
            disabled={exporting} 
            style={{ flex: 1, marginRight: 8 }}
          >
            Cancel
          </AppButton>
          <AppButton 
            variant="primary" 
            onPress={handleExport} 
            loading={exporting} 
            disabled={exporting} 
            style={{ flex: 1 }}
            icon={<Download size={16} color={appColors.background} />}
          >
            Generate Export
          </AppButton>
        </View>
      }
    >
      <AppSection title="Select Export Scope">
        <View style={styles.optionsGrid}>
          {scopes.map(s => {
            const isSelected = scope === s.key;
            return (
              <Pressable 
                key={s.key} 
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                onPress={() => setScope(s.key)}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.iconBox, { backgroundColor: isSelected ? '#8B5CF620' : appColors.elevatedSurface }]}>
                    <Layers size={18} color={isSelected ? '#8B5CF6' : appColors.textSecondary} />
                  </View>
                  {isSelected ? <CheckSquare size={18} color="#8B5CF6" /> : <Square size={18} color={appColors.textMuted} />}
                </View>
                <Text style={[styles.optionLabel, isSelected && { color: '#FFFFFF' }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppSection>

      <AppSection title="File Format" style={{ marginTop: appSpacing.xl }}>
        <View style={styles.optionsGrid}>
          <Pressable 
            style={[styles.optionCard, format === 'csv' && styles.optionCardActive]}
            onPress={() => setFormat('csv')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.iconBox, { backgroundColor: format === 'csv' ? '#8B5CF620' : appColors.elevatedSurface }]}>
                <FileText size={18} color={format === 'csv' ? '#8B5CF6' : appColors.textSecondary} />
              </View>
              {format === 'csv' ? <CheckSquare size={18} color="#8B5CF6" /> : <Square size={18} color={appColors.textMuted} />}
            </View>
            <Text style={[styles.optionLabel, format === 'csv' && { color: '#FFFFFF' }]}>Standard CSV (.csv)</Text>
            <Text style={styles.optionSub}>Universal comma-separated format for scripts and databases</Text>
          </Pressable>

          <Pressable 
            style={[styles.optionCard, format === 'excel' && styles.optionCardActive]}
            onPress={() => setFormat('excel')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.iconBox, { backgroundColor: format === 'excel' ? '#8B5CF620' : appColors.elevatedSurface }]}>
                <Table size={18} color={format === 'excel' ? '#8B5CF6' : appColors.textSecondary} />
              </View>
              {format === 'excel' ? <CheckSquare size={18} color="#8B5CF6" /> : <Square size={18} color={appColors.textMuted} />}
            </View>
            <Text style={[styles.optionLabel, format === 'excel' && { color: '#FFFFFF' }]}>Excel-Compatible CSV</Text>
            <Text style={styles.optionSub}>Adds a summary block, groups rows by list, and writes a UTF-8 BOM so Excel renders characters correctly</Text>
          </Pressable>
        </View>
      </AppSection>

      {result ? (
        <View style={[
          styles.resultBox, 
          { backgroundColor: result.type === 'success' ? '#10B98115' : '#EF444415', borderColor: result.type === 'success' ? '#10B98140' : '#EF444440' }
        ]}>
          {result.type === 'success' ? (
            <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 8 }} />
          ) : (
            <AlertCircle size={18} color="#EF4444" style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.resultText, { color: result.type === 'success' ? '#10B981' : '#EF4444' }]}>
            {result.message}
          </Text>
        </View>
      ) : null}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    padding: appSpacing.lg,
    borderRadius: appRadius.md,
  },
  optionCardActive: {
    backgroundColor: `${appColors.accent}12`,
    borderColor: appColors.accent,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: appRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  optionSub: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: appSpacing.md,
    borderRadius: appRadius.md,
    borderWidth: 1,
    marginTop: appSpacing.xl,
  },
  resultText: {
    ...appTypography.captionBold,
    flex: 1,
  },
});

