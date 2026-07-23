import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { EXPORT_COLUMNS } from './exportColumns';
import { getInventorySnapshot } from './inventorySnapshotService';

/**
 * Generates a CSV string from a canonical snapshot.
 */
const generateCsvContent = (snapshot) => {
  if (!snapshot || !snapshot.allItems) return '';

  const headerRow = EXPORT_COLUMNS.map(col => `"${col.header.replace(/"/g, '""')}"`).join(',');
  const dataRows = snapshot.allItems.map(item => {
    return EXPORT_COLUMNS.map(col => {
      const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
};

/**
 * Export inventory data as a CSV file and share it.
 * @param {Object} filter - Optional filter { listId, inventoryId }
 * @param {string} fileName - Optional file name
 */
export const exportToCsv = async (filter = {}, fileName = 'TRFPV_Inventory.csv') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    const csvContent = generateCsvContent(snapshot);
    
    const fileUri = FileSystem.documentDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: 'utf8'
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Inventory'
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('CSV Export failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export inventory data as an Excel-compatible CSV.
 * On mobile, we generate a richly formatted CSV since xlsx library is heavy.
 * The output is fully compatible with Excel/Google Sheets import.
 */
export const exportToExcel = async (filter = {}, fileName = 'TRFPV_Inventory.csv') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    
    // Build Excel-compatible CSV with summary header
    const lines = [];
    lines.push('Team Rotor FPV - Inventory Export');
    lines.push(`Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`);
    lines.push('');
    lines.push(`Total Lists,${snapshot.summary.totalLists}`);
    lines.push(`Total Inventories,${snapshot.summary.totalInventories}`);
    lines.push(`Total Sub-Inventories,${snapshot.summary.totalSubInventories}`);
    lines.push(`Total Items,${snapshot.summary.totalItems}`);
    lines.push(`Assigned Items,${snapshot.summary.assignedItems}`);
    lines.push(`Unassigned Items,${snapshot.summary.unassignedItems}`);
    lines.push(`Unique Holders,${snapshot.summary.uniqueHolders}`);
    lines.push('');

    // Data header
    lines.push(EXPORT_COLUMNS.map(col => `"${col.header}"`).join(','));

    // Data rows grouped by list
    const listNames = Object.keys(snapshot.lists).sort();
    for (const listName of listNames) {
      const items = snapshot.lists[listName] || [];
      const sorted = [...items].sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
      for (const item of sorted) {
        lines.push(EXPORT_COLUMNS.map(col => {
          const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(','));
      }
    }

    const content = lines.join('\n');
    const fileUri = FileSystem.documentDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: 'utf8'
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Inventory'
      });
    }

    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('Excel export failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get export scopes available based on context
 */
export const getExportScopes = (selectedListId, selectedInventoryId) => {
  const scopes = [];
  
  scopes.push({ key: 'full', label: 'Full Database', filter: {} });
  
  if (selectedListId) {
    scopes.push({ key: 'list', label: 'Current List', filter: { listId: selectedListId } });
  }
  
  if (selectedInventoryId) {
    scopes.push({ key: 'inventory', label: 'Selected Inventory', filter: { inventoryId: selectedInventoryId } });
  }
  
  return scopes;
};
