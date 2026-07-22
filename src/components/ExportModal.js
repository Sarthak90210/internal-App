import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, Button, Text, useTheme, RadioButton, ActivityIndicator } from 'react-native-paper';
import { exportToCsv, exportToExcel, getExportScopes } from '../services/inventoryExportService';

export default function ExportModal({ visible, onDismiss, listId, inventoryId }) {
  const theme = useTheme();
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const scopes = getExportScopes(listId, inventoryId);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const selectedScope = scopes.find(s => s.key === scope) || scopes[0];
      const exportFn = format === 'csv' ? exportToCsv : exportToExcel;
      const fileName = `TRFPV_Inventory_${scope}_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await exportFn(selectedScope.filter, fileName);
      
      if (res.success) {
        setResult({ type: 'success', message: `Exported ${res.itemCount} items successfully!` });
        setTimeout(() => {
          onDismiss();
          setResult(null);
        }, 1500);
      } else {
        setResult({ type: 'error', message: res.error || 'Export failed' });
      }
    } catch (error) {
      setResult({ type: 'error', message: error.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Export Inventory</Dialog.Title>
        <Dialog.Content>
          <Text variant="titleSmall" style={{ marginBottom: 8, fontWeight: 'bold' }}>Scope</Text>
          <RadioButton.Group onValueChange={setScope} value={scope}>
            {scopes.map(s => (
              <RadioButton.Item key={s.key} label={s.label} value={s.key} />
            ))}
          </RadioButton.Group>

          <View style={{ marginVertical: 8, height: 1, backgroundColor: '#eee' }} />

          <Text variant="titleSmall" style={{ marginBottom: 8, fontWeight: 'bold' }}>Format</Text>
          <RadioButton.Group onValueChange={setFormat} value={format}>
            <RadioButton.Item label="CSV (.csv)" value="csv" />
            <RadioButton.Item label="Excel-Compatible CSV" value="excel" />
          </RadioButton.Group>

          {exporting && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Generating export...</Text>
            </View>
          )}

          {result && (
            <Text style={{ 
              marginTop: 12, 
              color: result.type === 'success' ? theme.colors.primary : theme.colors.error,
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {result.message}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={exporting}>Cancel</Button>
          <Button onPress={handleExport} disabled={exporting} mode="contained">
            Export
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
