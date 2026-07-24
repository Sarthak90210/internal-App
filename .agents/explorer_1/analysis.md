# Comprehensive Analysis Report: Requirements R1 (Google Sheets Sync) & R2 (Excel Export)

**Target Codebase**: `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE` (`Inventory-App` & `Team-RotorFPV-Website`)  
**Investigated By**: Explorer 1 (`teamwork_preview_explorer`)  
**Date**: July 25, 2026  

---

## 1. Executive Summary

This report presents a thorough investigation of the Website codebase regarding **Requirement R1 (Google Sheets Sync)** and **Requirement R2 (Excel Export System)**. The investigation covered package dependencies, data formatting engines, snapshot builders, hook triggers, UI controllers, and network dispatch logic across both sub-projects (`Inventory-App` and `Team-RotorFPV-Website`).

### Key Findings Overview:
1. **Google Sheets Sync (R1)** is implemented as a debounced, multi-tab leader-elected webhook pipeline sending Version 2 JSON payloads to a Google Apps Script Web App using `fetch` with `mode: 'no-cors'` and `Content-Type: text/plain;charset=utf-8`.
2. **Excel Export System (R2)** relies on **SheetJS (`xlsx` v0.18.5)**. It builds multi-sheet workbooks comprising a master `Overview` sheet and individual list sheets formatted with metadata headers, custom column widths (`wch`), and sorted row records.

---

## 2. Requirement R1: Google Sheets Synchronization

### 2.1 Configuration & Storage Model
Google Sheets synchronization settings and operational statuses are persisted in Firestore under the `settings` collection:

- **Configuration Document**: `settings/google_sheets`
  - `enabled` (boolean): Master toggle for automated and manual sync.
  - `webhookUrl` (string): Google Apps Script Web App Deployment URL (`https://script.google.com/macros/s/...`).
  - `syncKey` (string): Authentication token string passed in payload.
  - `sheetUrl` (string): Direct web link to the Google Sheet for UI launching.
- **Status Document**: `settings/google_sheets_status`
  - `status` (`'syncing'` | `'connected'` | `'failed'` | `'not_configured'`): Current operational status.
  - `lastAttempt` / `lastSync` (Firestore Timestamp): Timestamps for tracking execution history.
  - `error` (string | null): Last error message recorded during sync execution.

---

### 2.2 Webhook Request Specifications
- **Webhook URL**: Retrieved dynamically from Firestore `settings/google_sheets.webhookUrl` (trimmed via `.trim()`).
- **HTTP Method**: `POST`
- **Request Mode**: `no-cors`  
  *Rationale*: Google Apps Script web apps do not return standard CORS headers on POST requests without redirection handling. Using `mode: 'no-cors'` prevents browser CORS errors while successfully delivering the POST body.
- **Headers**: `{ 'Content-Type': 'text/plain;charset=utf-8' }`  
  *Rationale*: `text/plain` avoids triggering a preflight HTTP `OPTIONS` request.
- **Body**: `JSON.stringify(payload)`

---

### 2.3 Payload Structure (Version 2)
The sync pipeline generates a single canonical snapshot object (`getInventorySnapshot()`) structured as follows:

```json
{
  "version": 2,
  "syncKey": "<cleanKey>",
  "generatedAt": "2026-07-25T02:20:00.000Z",
  "summary": {
    "totalLists": 4,
    "totalInventories": 12,
    "totalSubInventories": 8,
    "totalItems": 150,
    "uniqueItemRecords": 120,
    "assignedItems": 110,
    "unassignedItems": 40,
    "uniqueHolders": 15
  },
  "columns": [
    { "key": "itemName", "header": "Item Name" },
    { "key": "category", "header": "Category" },
    { "key": "inventoryPathString", "header": "Sub Inventory Path" },
    { "key": "quantity", "header": "Quantity" },
    { "key": "holder", "header": "Holder" },
    { "key": "previousHolder", "header": "Previous Holder" },
    { "key": "lastModified", "header": "Last Modified" },
    { "key": "modifiedBy", "header": "Modified By" },
    { "key": "previousModified", "header": "Previous Modified" },
    { "key": "previousModifiedBy", "header": "Previous Modified By" }
  ],
  "lists": {
    "Active Gear": [
      {
        "id": "item_001",
        "itemName": "FPV Frame 5inch",
        "category": "Frames",
        "quantity": 2,
        "inventoryId": "inv_101",
        "inventoryName": "Main Gear Box",
        "listId": "list_01",
        "listName": "Active Gear",
        "inventoryPathArray": ["Active Gear", "Main Gear Box"],
        "inventoryPathString": "Active Gear > Main Gear Box",
        "holder": "Sarthak",
        "previousHolder": "Alex",
        "lastModified": "7/24/2026, 2:30:00 PM",
        "modifiedBy": "Sarthak",
        "previousModified": "7/20/2026, 10:15:00 AM",
        "previousModifiedBy": "Alex"
      }
    ]
  }
}
```

---

### 2.4 Trigger Conditions & Multi-Tab Leader Election
Automated sync is controlled by the custom React hook `useGoogleSheetsSync` (`src/hooks/useGoogleSheetsSync.jsx`):

1. **Multi-Tab Leader Election**:
   - Uses `BroadcastChannel('trfpv_inventory_sync')` and `localStorage.setItem('trfpv_sync_leader', ...)` with a 10-second heartbeat check.
   - Prevents duplicate webhook dispatches when multiple browser tabs are open by restricting HTTP POST triggers strictly to the elected leader tab.
   - Recovers stale locks older than 30 seconds.
2. **Real-Time Data Change Monitor**:
   - Subscribes via Firestore `onSnapshot` to `inventories` and `items` collections.
   - Applies a **2-second debounce timer (`setTimeout(..., 2000)`)** to coalesce rapid sequential edits into a single sync execution.
3. **Periodic Fallback Timer**:
   - Executes `triggerGoogleSheetsSync()` every **20 minutes (`20 * 60 * 1000 ms`)** as a fallback.
4. **Manual & Admin Triggers**:
   - Triggered via the **Sync Now** button in `GoogleSheetsTab.jsx`.
   - Auto-dispatched when toggling `Enable Google Sheets Sync` ON with valid credentials.

---

### 2.5 Code Snippet & File Locations (R1)

#### Core Webhook Execution (`Inventory-App/src/lib/googleSheetsSync.js`):
```javascript
export const triggerGoogleSheetsSync = async () => {
  const configDoc = await getDoc(doc(db, 'settings', 'google_sheets'));
  if (!configDoc.exists()) return { success: false, error: "..." };
  const config = configDoc.data();
  if (!config.enabled || !config.webhookUrl?.trim() || !config.syncKey?.trim()) {
    return { success: false, error: "..." };
  }

  await setDoc(doc(db, 'settings', 'google_sheets_status'), {
    status: 'syncing',
    lastAttempt: serverTimestamp()
  }, { merge: true });

  const snapshot = await getInventorySnapshot();

  const payload = {
    version: 2,
    syncKey: config.syncKey.trim(),
    generatedAt: snapshot.generatedAt,
    summary: snapshot.summary,
    columns: EXPORT_COLUMNS.map(c => ({ key: c.key, header: c.header })),
    lists: snapshot.lists
  };

  await fetch(config.webhookUrl.trim(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  await setDoc(doc(db, 'settings', 'google_sheets_status'), {
    status: 'connected',
    lastSync: serverTimestamp(),
    error: null
  }, { merge: true });

  return { success: true, snapshot };
};
```

#### Relevant File Paths (R1):
- `Inventory-App/src/lib/googleSheetsSync.js` (Webhook POST logic)
- `Inventory-App/src/hooks/useGoogleSheetsSync.jsx` (Debounce listener & leader election)
- `Inventory-App/src/components/GoogleSheetsTab.jsx` (Admin configuration UI & manual trigger)
- `Inventory-App/src/components/OpenSheetButton.jsx` (Sheet URL launch button)
- `Team-RotorFPV-Website/src/lib/googleSheetsSync.js` (Mirror copy in website)

---

## 3. Requirement R2: Excel Export System

### 3.1 Excel Library Specification
- **Library Name**: `xlsx` (SheetJS)
- **Version Installed**: `^0.18.5`
- **Package Manifest Location**: `Inventory-App/package.json` (line 22) and `Team-RotorFPV-Website/package.json` (line 26)
- **Import Statement**: `import * as XLSX from 'xlsx';` (`Inventory-App/src/lib/inventoryExportService.js`, line 1)

---

### 3.2 Report Generator Architecture
Excel export generation is handled by `inventoryExportService.js` supported by `inventorySnapshotService.js` and `exportColumns.js`.

- **Primary Entry Function**: `exportToExcel(snapshot, fileName = 'TRFPV_Inventory.xlsx')`
- **CSV Fallback Function**: `exportToCsv(snapshot, fileName = 'TRFPV_Inventory.csv')`
- **Data Source**: Canonical snapshot created by `getInventorySnapshot(filter)` in `inventorySnapshotService.js`
- **Row Formatter**: `convertSnapshotToRows(items, columns)` in `exportColumns.js`

---

### 3.3 Workbook & Worksheet Layout Structure

#### Sheet 1: Master Overview Sheet (`Overview`)
Provides high-level metadata and aggregate inventory statistics.

```
+-------------------------------------------------------------+
| Team Rotor FPV - Inventory Overview                         |
| Generated: 7/25/2026, 2:20:00 AM                            |
|                                                             |
| Metric                    | Value                           |
| Total Lists               | 4                               |
| Total Inventories         | 12                              |
| Total Sub-Inventories     | 8                               |
| Total Items Count         | 150                             |
| Assigned Items            | 110                             |
| Unassigned Items          | 40                              |
| Unique Holders            | 15                              |
+-------------------------------------------------------------+
```
- **Column Widths**: `overviewWs['!cols'] = [{ wch: 25 }, { wch: 20 }];`

#### Sheets 2 to N: Individual Inventory List Sheets
One sheet per inventory list (e.g. `Active Gear`, `Archived Gear`, etc.), sorted alphabetically by `itemName`.

```
+----------------------------------------------------------------------------------------------------------------------+
| List Name: Active Gear           | Total Items: 45                 | Export Date: 7/25/2026                          |
| Generated automatically from Team Rotor FPV System.                                                                 |
|                                                                                                                      |
| Item Name | Category | Sub Inventory Path | Quantity | Holder | Prev Holder | Last Modified | Mod By | Prev Mod | Prev Mod By |
| ...       | ...      | ...                | ...      | ...    | ...         | ...           | ...    | ...      | ...        |
+----------------------------------------------------------------------------------------------------------------------+
```

- **Sheet Name Sanitization**:  
  Sheet names are cleaned to comply with Excel restrictions (max 31 characters, illegal characters `\ / ? * : [ ]` stripped):  
  `const cleanSheetName = listName.replace(/[\\/?*:[\]]/g, '').substring(0, 30);`

---

### 3.4 Column Scheme & Width Definitions (`exportColumns.js`)
Centralized column schema defining headers and explicit column character widths (`wch`):

| Key | Header Name | Column Width (`wch`) |
|---|---|---|
| `itemName` | Item Name | 25 |
| `category` | Category | 18 |
| `inventoryPathString` | Sub Inventory Path | 35 |
| `quantity` | Quantity | 12 |
| `holder` | Holder | 22 |
| `previousHolder` | Previous Holder | 22 |
| `lastModified` | Last Modified | 22 |
| `modifiedBy` | Modified By | 20 |
| `previousModified` | Previous Modified | 22 |
| `previousModifiedBy` | Previous Modified By | 20 |

---

### 3.5 UI Export Modal & Scopes (`ExportModal.jsx`)
The user triggers exports via `ExportModal.jsx`, which supports:
- **Export Scopes**:
  - `list`: Exports items in the currently active list (`filter = { listId: currentList.id }`).
  - `inventory`: Exports items in the selected sub-inventory (`filter = { inventoryId: currentInventory.id }`).
  - `full`: Exports the entire database (`filter = {}`).
- **File Formats**: Excel (`.xlsx`) or CSV (`.csv`).
- **Dynamic Filename**: `${filenamePrefix}_${YYYY-MM-DD}.${exportFormat}` (e.g. `TRFPV_Active_Gear_2026-07-25.xlsx`).

---

### 3.6 Code Snippet & File Locations (R2)

#### Core Excel Export Function (`Inventory-App/src/lib/inventoryExportService.js`):
```javascript
import * as XLSX from 'xlsx';
import { EXPORT_COLUMNS, convertSnapshotToRows } from './exportColumns';

export const exportToExcel = (snapshot, fileName = 'TRFPV_Inventory.xlsx') => {
  if (!snapshot || !snapshot.lists) return;

  const wb = XLSX.utils.book_new();

  // 1. Master Overview Sheet
  const overviewData = [
    ['Team Rotor FPV - Inventory Overview'],
    [`Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`],
    [''],
    ['Metric', 'Value'],
    ['Total Lists', snapshot.summary.totalLists],
    ['Total Inventories', snapshot.summary.totalInventories],
    ['Total Sub-Inventories', snapshot.summary.totalSubInventories],
    ['Total Items Count', snapshot.summary.totalItems],
    ['Assigned Items', snapshot.summary.assignedItems],
    ['Unassigned Items', snapshot.summary.unassignedItems],
    ['Unique Holders', snapshot.summary.uniqueHolders]
  ];

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
  overviewWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview');

  // 2. Individual List Sheets
  const listNames = Object.keys(snapshot.lists).sort();
  
  listNames.forEach(listName => {
    const items = snapshot.lists[listName] || [];
    const sortedItems = [...items].sort((a, b) => a.itemName.localeCompare(b.itemName));

    const metaRows = [
      [`List Name: ${listName}`, `Total Items: ${sortedItems.length}`, `Export Date: ${new Date().toLocaleDateString()}`],
      ['Generated automatically from Team Rotor FPV System.'],
      ['']
    ];

    const headerRow = EXPORT_COLUMNS.map(col => col.header);
    const dataRows = convertSnapshotToRows(sortedItems, EXPORT_COLUMNS);

    const sheetContent = [...metaRows, headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetContent);

    ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: col.width || 20 }));

    const cleanSheetName = listName.replace(/[\\/?*:[\]]/g, '').substring(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // 3. Save File
  XLSX.writeFile(wb, fileName);
};
```

#### Relevant File Paths (R2):
- `Inventory-App/package.json` (xlsx dependency)
- `Inventory-App/src/lib/inventoryExportService.js` (Excel and CSV download generator)
- `Inventory-App/src/lib/exportColumns.js` (Column schema & widths)
- `Inventory-App/src/lib/inventorySnapshotService.js` (Canonical data builder)
- `Inventory-App/src/components/ExportModal.jsx` (Export UI modal component)
- `Team-RotorFPV-Website/src/lib/inventoryExportService.js` (Mirror copy in website)

---

## 4. Synthesis & Recommendations

Both Requirement R1 (Google Sheets Sync) and Requirement R2 (Excel Export) are fully implemented, robust, and well-architected.

### Recommended Next Steps for Implementation Team:
1. **Google Sheets Apps Script Verification**: Ensure the Google Apps Script receiving end parses Version 2 JSON payloads matching `payload.lists` and `payload.columns`.
2. **Export Modal CSS Patch**: In `Inventory-App/src/components/ExportModal.jsx`, ensure the `.spin` class is present in CSS so the spinner rotates during export generation.
