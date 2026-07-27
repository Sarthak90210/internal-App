# RFV App — Code Audit & Fix Report

Audited `App.js`, `src/**`, `tests/`, `scripts/`, `app.json`, `package.json` (~13k LOC).
**All JS-level findings below are fixed.** Native/config items were deliberately deferred — see `NATIVE_CLEANUP_TODO.md`.

**Version:** 2.1.0 → **2.2.0**, `versionCode` 10 → 11, runtime stays **2** (JS-only, OTA-deployable).

## Verification

| Check | Result |
|---|---|
| Babel parse, all 69 source files | 0 syntax errors |
| Undefined design-token references | **58 → 0** |
| Component prop-contract mismatches (AST) | **38 → 0** |
| Dangling refs to deleted symbols | 0 |
| Bare `alert()` calls | **4 → 0** |
| `npm test` | **33/33 pass, exit 0** (previously never terminated) |

> A follow-up pass fixed profile-picture uploads, which were failing for every
> non-admin user. The root cause was server-side. See **`PROFILE_UPLOAD_FIX.md`** —
> **the server must be redeployed** or that bug persists regardless of the app build.

---

## P0 — Runtime-breaking bugs (fixed)

### 1. `moveInventory` called with the wrong signature
`FolderDetailScreen.js` invented its own 3-string convention; the service expects `(inventoryId, destinationObject, allInvs)`. `destination.type` came back `undefined`, execution fell to the else branch, and `allInvs.find(...)` ran on a **string** → `TypeError`, swallowed into `alert('Failed to move')`. **Moving sub-folders never worked.**
→ Now forwards `(invId, dest, allInvs)`, matching `InventoryDetailScreen`.

### 2. `AppEmptyState` prop mismatch — 15 call sites
Component accepted `message`; **every** caller passed `description`. Users always saw the hardcoded default *"There is nothing to display here yet."*
→ Component now accepts `description`, with `message` kept as an alias.

### 3. `AppCard variant=` — 19 call sites
Component took `elevated` (boolean); 19 sites passed `variant="elevated"|"surface"`, which fell into `...props` and was spread onto a `View`. Every "elevated" card rendered flat.
→ `variant` is now a real prop; `elevated` still works.

### 4. `AppChip label=` — 4 call sites rendered **completely empty**
Component takes `children`; `ManageContactMessagesScreen` (×3) and `ManageTeamScreen` (×1) passed `label`. Those filter chips showed no text at all.
→ `label` now supported as a fallback for `children`.

### 5. 58 references to design tokens that didn't exist
`appTypography.bodyBold` (14), `.captionBold` (17), `.h2`, `.title`, `.button`; `appRadius.full` (4), `.lg` (4); `appColors.primary` (5), `.secondary` (3) — across **17 files**. `{...undefined}` is a silent no-op, so a large slice of intended styling had never rendered. `` `${appColors.primary}15` `` was producing the literal string `"undefined15"`.
→ All tokens added to `theme.js`. `primary`/`secondary` are deliberately 6-digit hex because screens concatenate alpha suffixes onto them.

### 6. `navigate() || goBack()` — always fired both
`navigate()` returns `undefined`, so the breadcrumb always navigated *then* immediately popped. → `goBack()` removed.

### 7. `heldBy` — a field that exists nowhere in the schema
Global search filtered on `inv.heldBy === user.id`; the whole codebase uses `currentHolder` matched on **email**. "Holds N folders" was permanently `0`. → Now matches `currentHolder` on email with an id fallback.

### 8. Un-awaited `forEach(async …)` in `assignHolder`
Fire-and-forget writes; the function resolved before they landed. The identical operation 60 lines above already used `Promise.all`. → Now `Promise.all`.

### 9. Side effects inside a Zustand updater (`tagStore`)
`initTags` called `set()` *inside* a `set(state => …)` updater and opened a Firestore subscription there. Updaters must be pure — StrictMode double-invocation leaked a listener, and the `initialized` guard raced because the flag was only set in the async callback.
→ Subscription moved outside the updater; `initialized` now flips synchronously.

### 10. Unbounded tree walks (2 sites)
`MoveDestinationModal.isInvalid` and `FolderDetailScreen.renderBreadcrumbs` walked `parentInventoryId` with no depth cap — a cycle would hang the render thread. → Both now depth-capped at 20 with a `seen` set, matching `inventorySnapshotService`.

### 11. Settings singletons written with `updateDoc`
`updateGallerySettings` / `updateSponsorSettings` used `updateDoc` on `settings/gallery` and `settings/sponsors`, which **throws** if the doc has never been created — i.e. on any fresh environment. The test suite documented this as a known defect rather than fixing it.
→ Both now use `setDoc(..., { merge: true })`.

### 12. Dead render branch in the audit log
History cards read `item.oldQuantity`, but `subscribeToHistory` emitted neither `oldQuantity` nor `newQuantity`. The quantity-change line could never display. → Service now projects `previousQuantity`/`newQuantity`; the view reads the correct field.

---

## P1 — Dead code (removed)

**Orphaned Expo template subtree** — a second, unused theming system living next to the real `src/theme.js`:
`themed-text.tsx`, `themed-view.tsx`, `constants/theme.ts`, `hooks/use-theme.ts`, `hooks/use-color-scheme.ts`, `hooks/use-color-scheme.web.ts`, `global.css`.
`constants/theme.ts` imported `@/global.css` despite **no NativeWind/Tailwind** in the project — it would have thrown had anything imported it.

**Unused exports:** `adminApi.apiGet`, `InventoryService.cleanupOrphans` (50 lines), `exportColumns.convertSnapshotToRows`, `InventoryService.getAllItems`.

**Pointless defensive guard:** `FolderDetailScreen` did `InventoryService.subscribeToAllItems?.(…) || (() => {})` then `if (!InventoryService.subscribeToAllItems) { getAllItems() }` — against a static object literal in the same repo. That dead branch was the only reason `getAllItems` existed.

**Fake loading state:** `setTimeout(() => setLoading(false), 600)` — arbitrary, unrelated to data arrival, and never cleared on unmount. → Skeleton now clears when the first snapshot lands.

**Also removed:** unused `userName`/`userEmail` params on `updateMessageStatus` (and the now-dead `useAuthStore` import it forced), unused `get` in `updateStore`, unused `descriptors` in `AppBottomNavigation`, `GlassSurface`'s inert web-port props (`brightness`, `blur`, `displace`, `saturation`) and its no-op `typeof width === 'number'` check, unused `lists`/`items` on the snapshot `context`, and `tests/test_prototype.js` (a 24-line scratch file referenced by nothing).

---

## P2 — Duplication & inconsistency (fixed)

**Six helpers were defined twice**, once in `FolderDetailScreen` and once in `InventoryDetailScreen` — and the two `getRelativeTime` implementations produced **different output for the same input** (one read `.seconds` and had a weeks bucket; the other did `new Date()` arithmetic with a seconds bucket and no weeks).
→ Extracted to `src/lib/inventoryHelpers.js`: `getRelativeTime`, `getHolderName`, `calculateDescendantItemCount` (now cycle-safe), `getStatusBadgeVariant`, `resolveStatus`, `toggleInSet`, `toggleSelectAll`.

**`exportToExcel` didn't do what it said.** Named "Excel", wrote CSV, and the UI claimed *"Includes BOM header for seamless Excel character rendering"* — **no BOM was ever written**. `ExportModal` also hardcoded `.csv` in the filename regardless of format, and the CSV row serializer existed twice in the same file.
→ Single shared serializer; the UTF-8 BOM is now actually written; filenames distinguish the two formats; UI copy describes what the code genuinely does. It remains a CSV (a real `.xlsx` needs a spreadsheet library — flagged as a follow-up, not silently faked).

**Redundant auth work.** `signInWithGoogleToken` re-implemented the entire claims + authorization check that `initializeAuthListener` performs anyway when `signInWithCredential` fires `onAuthStateChanged` — and the two copies handled failure *differently* (one threw, one warned and assumed authorized).
→ Both now share `resolveAuthorization()` and `applyRoles()`. The listener still keeps the session on a network error rather than booting the user offline.

**Deprecated API in one file.** 7 image-picker call sites used the modern `mediaTypes: ['images']`; `ManageSponsorsScreen:168` alone used the removed `ImagePicker.MediaTypeOptions.All/.Images`. → Modernised.

**Also:** 4 bare `alert()` calls → `Alert.alert` with real titles; `AppBadge` gained the `primary`/`secondary` variants that were being passed but silently ignored; the precedence-ambiguous `a || b ? x : y` in the snapshot service is now explicitly parenthesised and named; the build script's hardcoded `V1.1.1` filename now reads the version from `package.json`.

---

## Test suite

`npm test` **never terminated before** — the harness crashed on `expo-constants` (the one Expo module the mock registry missed), which pulled in `expo-modules-core`'s raw `.ts` sources.
→ Mock added; the suite now runs clean in ~0.01s.

Three tests were written to *assert the bugs existed* rather than fix them. All three are now regression tests asserting correct behaviour:

| Was | Now |
|---|---|
| `[BUG VERIFICATION 1] moveInventory fails when passed string parameters` | `moveInventory into a parent inventory (FolderDetailScreen path)` |
| `[BUG VERIFICATION 3A] updateGallerySettings fails when doc is missing` | `updateGallerySettings creates the settings doc when missing` |
| `[BUG VERIFICATION 3B] updateSponsorSettings fails when doc is missing` | `updateSponsorSettings creates the settings doc when missing` |

---

## Deferred

See **`NATIVE_CLEANUP_TODO.md`** — removing `expo-router` (configured but entirely unused), 10 unused native deps, the iOS/Android `runtimeVersion` mismatch, `usesCleartextTraffic`, hardcoded OAuth client IDs, and the 480 MB `APK Builds/` folder. All require a runtime bump (2 → 3) and a fresh build, so they can't ride an OTA update.

**Note:** `git diff --stat` also includes 12 files you already had modified before this audit began.
