# Handoff Report

## 1. Observation
- Inspected the Website codebase (`c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website`, `socials`, `Inventory-App`).
- **Backend API Endpoints**:
  - `server/index.js` defines `/api/setAdmin` (lines 207-230), `/api/removeAdmin` (lines 232-273), `/api/setSuperAdmin` (lines 276-298), `/api/removeSuperAdmin` (lines 301-339), `/api/admins` (lines 342-377), `/api/admin/users/create` (lines 965-1000), `/api/admin/requests/approve` (lines 901-940).
  - Custom claim middleware in `server/auth.js` (`verifyAuth`, `verifyAdmin`, `verifySuperAdmin`).
- **Firestore Security Rules**:
  - `firestore.rules`:
    - `tags`: `allow read, write: if isAdmin();` (lines 89-91)
    - `social_links`: `allow read: if true; allow create, update, delete: if isAdmin();` (lines 122-125)
    - `users`: Granular update controls ensuring self-updates cannot modify sensitive keys (`['permissions', 'tags', 'isAdmin', 'isSuperAdmin', 'boardGroup']`) (lines 78-87).
- **Frontend Components & Business Logic**:
  - `src/components/admin/TagsTab.jsx`: CRUD interface for tags collection (`grantsAdmin`, `grantsSuperAdmin`, `isGroup`, `isExMember`, `grantsTags`).
  - `src/components/admin/TeamMembersTab.jsx`: Roster management, tag toggling, and join request approval.
  - `Inventory-App/src/lib/tagGrants.js`: Implements 1-level tag grant expansion (`expandTagIds`) and Board default tags (`getGrantedTagIds`).
  - `src/lib/adminApi.js`: Client API helpers (`apiPost`, `apiGet`), admin activity logger (`logAdminAction`), and claim synchronization (`syncUserPermissions`).
  - `src/components/admin/SocialsTab.jsx`: Real-time CRUD for `social_links` with icon selection preview, order weight, and visibility toggle.
  - `src/components/Footer.jsx` & `socials/src/App.jsx`: Public consumption of `social_links` ordered by `order` and filtered for `enabled !== false`.

## 2. Logic Chain
1. **Observation**: `tags` collection documents contain boolean flags `grantsAdmin` and `grantsSuperAdmin`, plus `grantsTags` array for tag linking.
2. **Step**: When an admin modifies user tags in `TeamMembersTab.jsx`, `handleTagToggle` invokes `getGrantedTagIds` to resolve direct defaults.
3. **Step**: On save, `expandTagIds` expands selected tags with direct defaults (1-level non-recursive expansion).
4. **Step**: `syncUserPermissions` in `adminApi.js` checks if any expanded tag requires admin/superAdmin claims. If desired claims differ from current Auth claims in `/api/admins`, `syncUserPermissions` issues HTTP POST calls to `/api/setAdmin`, `/api/removeAdmin`, `/api/setSuperAdmin`, or `/api/removeSuperAdmin`.
5. **Step**: Backend endpoints verify request JWTs via `verifySuperAdmin` middleware and apply Firebase Auth custom claims (`setCustomUserClaims`), sync Firestore `admins` collection, and write audit entries to `audit_logs`.
6. **Observation**: Social links are stored in Firestore collection `social_links` (`title`, `url`, `icon`, `order`, `enabled`).
7. **Step**: `SocialsTab.jsx` provides an admin CRUD interface enforcing `isAdmin()` rules, logging actions to `activity_logs`.
8. **Step**: `Footer.jsx` on the main website and `socials/src/App.jsx` on the dedicated link-tree site execute Firestore queries on `social_links` ordered by `order` ascending, filtering `enabled !== false`, and rendering the icon catalog.

## 3. Caveats
- Direct execution of backend server tests was not conducted as this is a read-only investigation.
- Firebase Auth custom claim changes take effect immediately on backend token verification after token refresh, but existing client sessions must refresh ID tokens (`getIdTokenResult(true)`) to update Firestore Security Rule evaluation.

## 4. Conclusion
The Website codebase contains a fully implemented, production-grade architecture for both Requirements R3 (Tag Management & Permissions) and R4 (Social Links Management).
- **R3** features a clean 1-level tag grant inheritance system, automated claim synchronization via Express API endpoints, and Firestore security rules guarding user data and role claims.
- **R4** features a flexible `social_links` collection with order weighting and toggleable visibility, seamlessly shared across the Admin UI, main site footer, and standalone link-tree app (`socials`).

## 5. Verification Method
1. Inspect files:
   - `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website\server\index.js`
   - `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website\firestore.rules`
   - `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website\src\components\admin\TagsTab.jsx`
   - `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website\src\components\admin\SocialsTab.jsx`
   - `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App\.agents\explorer_2\analysis.md`
2. Verify that `analysis.md` correctly details all backend API endpoints, Firestore schemas, UI design patterns, and permission hierarchy logic.
