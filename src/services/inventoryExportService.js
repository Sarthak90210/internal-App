import { documentDirectory, writeAsStringAsync } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { EXPORT_COLUMNS } from './exportColumns';
import { getInventorySnapshot } from './inventorySnapshotService';

// Excel only auto-detects UTF-8 in a CSV if the file opens with a byte order
// mark. Without it, accented characters and symbols render as mojibake.
const UTF8_BOM = '﻿';

const escapeCell = (value) => {
  const str = value !== undefined && value !== null ? String(value) : '';
  return `"${str.replace(/"/g, '""')}"`;
};

const headerRow = () => EXPORT_COLUMNS.map(col => escapeCell(col.header)).join(',');

const itemRow = (item) => EXPORT_COLUMNS.map(col => escapeCell(item[col.key])).join(',');

/**
 * Write `content` to the app document directory and hand it to the share sheet.
 */
const writeAndShare = async (fileName, content) => {
  const fileUri = documentDirectory + fileName;
  await writeAsStringAsync(fileUri, content, { encoding: 'utf8' });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Inventory',
  });
};

/**
 * Plain CSV: header row plus one row per item, no summary block.
 * @param {Object} filter - Optional { listId, inventoryId }
 */
export const exportToCsv = async (filter = {}, fileName = 'TRFPV_Inventory.csv') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    const lines = [headerRow(), ...snapshot.allItems.map(itemRow)];

    await writeAndShare(fileName, lines.join('\n'));
    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('CSV Export failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Excel-oriented CSV: UTF-8 BOM, a summary block, and rows grouped by list.
 * This is still a .csv — Excel opens it natively. It is deliberately not a
 * real .xlsx workbook; that would require a spreadsheet library on the client.
 */
export const exportToExcel = async (filter = {}, fileName = 'TRFPV_Inventory.csv') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    const { summary } = snapshot;

    const lines = [
      'Team Rotor FPV - Inventory Export',
      `Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`,
      '',
      `Total Lists,${summary.totalLists}`,
      `Total Inventories,${summary.totalInventories}`,
      `Total Sub-Inventories,${summary.totalSubInventories}`,
      `Total Items,${summary.totalItems}`,
      `Assigned Items,${summary.assignedItems}`,
      `Unassigned Items,${summary.unassignedItems}`,
      `Unique Holders,${summary.uniqueHolders}`,
      '',
      headerRow(),
    ];

    for (const listName of Object.keys(snapshot.lists).sort()) {
      const items = [...(snapshot.lists[listName] || [])]
        .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
      for (const item of items) {
        lines.push(itemRow(item));
      }
    }

    await writeAndShare(fileName, UTF8_BOM + lines.join('\n'));
    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('Excel export failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export scopes available given the current screen context.
 */
export const getExportScopes = (selectedListId, selectedInventoryId) => {
  const scopes = [{ key: 'full', label: 'Full Database', filter: {} }];

  if (selectedListId) {
    scopes.push({ key: 'list', label: 'Current List', filter: { listId: selectedListId } });
  }
  if (selectedInventoryId) {
    scopes.push({ key: 'inventory', label: 'Selected Inventory', filter: { inventoryId: selectedInventoryId } });
  }

  return scopes;
};
