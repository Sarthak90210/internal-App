# Handoff Report: Website Codebase Investigation (R1 & R2)

**Agent**: Explorer 1 (`teamwork_preview_explorer`)  
**Working Directory**: `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App\.agents\explorer_1`  
**Date**: 2026-07-25  

---

## 1. Observation

Direct code observations from inspecting `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE`:

### R1 (Google Sheets Sync):
- **Webhook POST Function**: Defined in `Inventory-App/src/lib/googleSheetsSync.js` (lines 6-81) and mirrored in `Team-RotorFPV-Website/src/lib/googleSheetsSync.js`.
  - Fetch call (lines 56-61):
    ```javascript
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    ```
- **Configuration & Status Docs**:
  - `doc(db, 'settings', 'google_sheets')` — contains `enabled`, `webhookUrl`, `syncKey`, `sheetUrl`.
  - `doc(db, 'settings', 'google_sheets_status')` — tracks `status` (`'syncing'`, `'connected'`, `'failed'`), `lastAttempt`, `lastSync`, `error`.
- **Payload Structure (Version 2)**:
  - Version: 2, `syncKey`: string, `generatedAt`: ISO string, `summary`: snapshot summary object, `columns`: `EXPORT_COLUMNS` header mapping, `lists`: grouped items by list name.
- **Trigger Conditions**:
  - `Inventory-App/src/hooks/useGoogleSheetsSync.jsx`: `onSnapshot` listeners on `inventories` and `items` collections with a 2-second debounce timer (`setTimeout(..., 2000)`).
  - Periodic fallback every 20 minutes (`20 * 60 * 1000 ms`).
  - Multi-tab leader election via `BroadcastChannel('trfpv_inventory_sync')` and `localStorage` key `'trfpv_sync_leader'` with 10-second heartbeat.
  - Manual sync trigger in `Inventory-App/src/components/GoogleSheetsTab.jsx`.

### R2 (Excel Export System):
- **Excel Library**:
  - `xlsx` version `^0.18.5` in `Inventory-App/package.json` (line 22) and `Team-RotorFPV-Website/package.json` (line 26).
  - Imported in `Inventory-App/src/lib/inventoryExportService.js` (line 1): `import * as XLSX from 'xlsx';`.
- **Export Generator Functions**:
  - `exportToExcel(snapshot, fileName)` in `Inventory-App/src/lib/inventoryExportService.js` (lines 7-62).
  - `exportToCsv(snapshot, fileName)` in `Inventory-App/src/lib/inventoryExportService.js` (lines 67-89).
- **Worksheet Layout & Formatting**:
  - Sheet 1: `Overview` containing metadata title, timestamp, empty row, metric table (`Total Lists`, `Total Inventories`, `Total Sub-Inventories`, `Total Items Count`, `Assigned Items`, `Unassigned Items`, `Unique Holders`). Column widths set to `[{ wch: 25 }, { wch: 20 }]`.
  - Sheets 2..N: One sheet per inventory list (cleaned via `listName.replace(/[\\/?*:[\]]/g, '').substring(0, 30)`). Metadata header rows (List Name, Total Items, Export Date), table header row, and data rows sorted by `itemName`.
- **Column Scheme & Widths** (`Inventory-App/src/lib/exportColumns.js`):
  - `EXPORT_COLUMNS`: 10 columns (`itemName` [25], `category` [18], `inventoryPathString` [35], `quantity` [12], `holder` [22], `previousHolder` [22], `lastModified` [22], `modifiedBy` [20], `previousModified` [22], `previousModifiedBy` [20]). Column width set via `ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: col.width || 20 }));`.

---

## 2. Logic Chain

1. **R1 Logic Chain**:
   - Inspecting `package.json` and `src/lib/googleSheetsSync.js` showed how settings are pulled from Firestore (`settings/google_sheets`).
   - Checking `src/hooks/useGoogleSheetsSync.jsx` revealed real-time `onSnapshot` listeners on Firestore `inventories` and `items` collections.
   - The 2-second debounce timer ensures multiple quick edits in UI are coalesced into a single payload.
   - The `BroadcastChannel` leader election logic ensures only one browser tab sends the HTTP POST request to Google Apps Script.
   - `fetch` uses `mode: 'no-cors'` and `Content-Type: 'text/plain;charset=utf-8'` to bypass browser CORS restriction on Apps Script Web App endpoints.

2. **R2 Logic Chain**:
   - Inspecting `package.json` confirmed `xlsx` (SheetJS) v0.18.5 is the exact Excel library.
   - Inspecting `inventoryExportService.js` revealed `exportToExcel`, which uses `XLSX.utils.book_new()`, `XLSX.utils.aoa_to_sheet()`, `XLSX.utils.book_append_sheet()`, and `XLSX.writeFile()`.
   - Data structure is provided by `getInventorySnapshot()`, generating canonical snapshot objects.
   - `exportColumns.js` defines `EXPORT_COLUMNS` with explicit `wch` values applied to `ws['!cols']`.
   - `ExportModal.jsx` provides UI controls for selecting export scope (`list`, `inventory`, `full`) and format (`xlsx`, `csv`).

---

## 3. Caveats

- **External Webhooks**: The live Google Apps Script endpoint (`webhookUrl`) is configured at runtime in Firestore `settings/google_sheets`. The actual Apps Script code running inside Google Apps Script was not inspected as it lives in Google's cloud script editor.
- **Read-Only Scope**: No code changes were made to source files in `WEBSITE` or `App` as required by read-only investigation rules. All outputs were written strictly to `.agents/explorer_1/`.

---

## 4. Conclusion

- **R1 (Google Sheets Sync)** is fully implemented, using `fetch` (`no-cors`, `text/plain`), Version 2 JSON payloads, Firestore snapshot builders, 2-second debouncing, 20-minute fallback polling, multi-tab leader election, and Admin UI management.
- **R2 (Excel Export System)** is fully implemented using SheetJS `xlsx` v0.18.5, generating multi-sheet workbooks with an `Overview` summary sheet and individual list sheets, custom column widths (`wch`), formatted metadata headers, and CSV/Excel export options via `ExportModal.jsx`.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Inventory-App\package.json` line 22 for `"xlsx": "^0.18.5"`.
2. Inspect `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Inventory-App\src\lib\googleSheetsSync.js` for `triggerGoogleSheetsSync` and Version 2 payload.
3. Inspect `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Inventory-App\src\hooks\useGoogleSheetsSync.jsx` for leader election and 2-second debounce timer.
4. Inspect `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Inventory-App\src\lib\inventoryExportService.js` for `exportToExcel` and multi-sheet creation.
5. Inspect `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Inventory-App\src\lib\exportColumns.js` for `EXPORT_COLUMNS` and column widths (`wch`).
