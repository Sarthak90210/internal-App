# Comprehensive Analysis Report: Tag Management & Permissions (R3) and Social Links Management (R4)

**Date**: 2026-07-25  
**Investigator**: Explorer 2 (`teamwork_preview_explorer`)  
**Scope**: Website Codebase (`c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE`) & Backend API  

---

## Executive Summary

This report presents a thorough investigation of the **Team Rotor FPV Website & Backend System** regarding:
1. **Requirement R3 (Tag Management & Permissions)**: Data models, backend API routes, role claim synchronization, single-level tag inheritance, and administrative UI interfaces.
2. **Requirement R4 (Social Links Management)**: Centralized data structures, Firestore security rules, client-side CRUD workflows, and public consumption patterns across the main website footer and the dedicated link-tree site.

The system uses a hybrid architecture:
- **Frontend / Client Layer**: Vite + React single-page applications (`Team-RotorFPV-Website`, `Inventory-App`, `socials`).
- **Data Access & Storage**: Firebase Firestore for real-time document storage, Firebase Auth for user authentication with Custom Claims (`admin`, `superAdmin`, `inventory`).
- **Backend API**: Express.js server (`server/index.js`) using Firebase Admin SDK for privilege elevation, custom claim management (`setCustomUserClaims`), service-signed media/3D uploads (Cloudinary / Supabase), and audit logging.

---

## 1. Requirement R3: Tag Management & Permissions

### 1.1 Architecture & Role Hierarchy

The permission model follows a multi-tier structure:
- **Root Super Admin**: Defined via environment variable `SUPER_ADMIN_EMAIL` (or `process.env.VITE_SUPER_ADMIN_EMAIL`). Root privileges cannot be revoked via API/UI.
- **Super Admin**: Has custom claim `{ admin: true, superAdmin: true }`. Can manage team members (`TeamMembersTab`), accept join requests, execute dynamic user provisioning, view security/activity logs (`LogsTab`), and grant/revoke tags.
- **Admin**: Has custom claim `{ admin: true }`. Can manage content across main tabs (`Gallery`, `Events`, `Drones`, `Achievements`, `Sponsors`, `Board`, `Socials`, `Messages`, `Traffic`, `Tags`).
- **Inventory Admin**: Has custom claim `{ inventory: true }` or `{ admin: true }` or `{ superAdmin: true }`. Can access `Inventory-App` resources (`inventory_lists`, `inventories`, `items`, `item_history`, `inventory_hold_history`).
- **Team Member**: Authenticated user present in `users` collection with `status: 'active'`.

```
                    ┌─────────────────────────┐
                    │    Root Super Admin     │
                    │   (SUPER_ADMIN_EMAIL)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       Super Admin       │
                    │ (admin=true,super=true) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │          Admin          │
                    │      (admin=true)       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Inventory Admin     │
                    │(inventory=true|admin=t) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       Team Member       │
                    │ (user status = active)  │
                    └─────────────────────────┘
```

---

### 1.2 Data Schemas & Models

#### A. Collection: `tags` (`tags/{tagId}`)
Stores tag definition metadata and permission grant flags.

| Field Name | Type | Description | Default |
|---|---|---|---|
| `name` | string | Display name of the tag (e.g., "Board", "Core Team", "Admin") | Required |
| `grantsAdmin` | boolean | If `true`, assigning this tag automatically grants `admin` access claims | `false` |
| `grantsSuperAdmin` | boolean | If `true`, assigning this tag automatically grants `superAdmin` access claims | `false` |
| `isGroup` | boolean | Indicates whether the tag acts as an organizational/inventory group | `true` |
| `isExMember` | boolean | If `true`, marks tag for alumni/former members (hides from active views) | `false` |
| `grantsTags` | array\<string\> | List of target `tagId`s automatically granted upon assigning this tag | `[]` |

#### B. Collection: `users` (`users/{email}`)
User profile document indexed by lowercase user email.

| Field Name | Type | Description |
|---|---|---|
| `email` | string | User email address (Document ID = `email.toLowerCase()`) |
| `name` | string | Display name of member |
| `registrationNumber` | string | Student registration number (VIT format) |
| `tags` | array\<string\> | Array of assigned `tagId`s (includes expanded direct grants) |
| `customFields` | map | Key-value dictionary of dynamic custom fields (`{ fieldId: string }`) |
| `status` | string | Account status: `'active'`, `'approved_unverified'`, `'rejected'` |
| `emailVerified` | boolean | Whether email address verification token was redeemed |
| `isActive` | boolean | Flag for active status (`false` when archived) |
| `isArchived` | boolean | Flag indicating archived state |

#### C. Collection: `admins` (`admins/{email}`)
Firestore cache collection populated by backend API for rapid admin lookup.

| Field Name | Type | Description |
|---|---|---|
| `email` | string | Admin email address |
| `isSuperAdmin` | boolean | Whether admin has Super Admin claims |
| `isRoot` | boolean | Whether admin email matches `SUPER_ADMIN_EMAIL` |

---

### 1.3 Permission Inheritance Logic

Tag inheritance rules are governed by helper services (`tagGrants.js` and `adminApi.js`):

1. **Board Tag Special Grant (`getGrantedTagIds`)**:
   - Located in `Inventory-App/src/lib/tagGrants.js` and referenced across admin tabs.
   - When `tag.name === 'Board'`, if `tag.grantsAdmin === true`, it implicitly resolves the `'Admin'` tag ID. If `tag.grantsSuperAdmin === true`, it implicitly resolves the `'Super Admin'` tag ID.

2. **Single-Level Tag Inheritance (`expandTagIds`)**:
   - Inheritance is **strictly 1-level deep** (non-recursive) to prevent circular dependency chains or uncontrolled permission proliferation.
   - Algorithm:
     ```javascript
     export const expandTagIds = (selectedTagIds, allTags) => {
       const expanded = [...new Set(selectedTagIds || [])];
       for (const tagId of selectedTagIds || []) {
         const tag = allTags.find(candidate => candidate.id === tagId);
         for (const grantedTagId of getGrantedTagIds(tag, allTags)) {
           if (!expanded.includes(grantedTagId)) expanded.push(grantedTagId);
         }
       }
       return expanded;
     };
     ```

3. **Custom Claims Synchronization (`syncUserPermissions`)**:
   - Executed when saving user profiles in `TeamMembersTab.jsx` or updating team members in `TeamTab.jsx`.
   - Iterates through the expanded `selectedTagIds`:
     - If any tag has `grantsAdmin === true` => `targetIsAdmin = true`.
     - If any tag has `grantsSuperAdmin === true` => `targetIsSuperAdmin = true` (and `targetIsAdmin = true`).
   - Compares desired state (`targetIsAdmin`, `targetIsSuperAdmin`) against current record from `/api/admins`.
   - Protects root admin (`currentAdminRec.isRoot === true` => skip modifications).
   - Issues REST API calls to backend endpoints (`/api/setAdmin`, `/api/removeAdmin`, `/api/setSuperAdmin`, `/api/removeSuperAdmin`).

---

### 1.4 Backend API Routes (R3)

All backend endpoints are defined in `server/index.js` and utilize Firebase Admin SDK.

#### 1. `POST /api/setAdmin`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "email": "user@vit.ac.in"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Successfully granted admin privileges to user@vit.ac.in"
  }
  ```
- **Behavior**: Retrieves or creates Auth user, calls `setCustomUserClaims(uid, { admin: true, superAdmin: isSuper })`, writes merge to `admins/{email}`, appends `audit_logs` record.

#### 2. `POST /api/removeAdmin`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "email": "user@vit.ac.in"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Successfully revoked admin privileges from user@vit.ac.in"
  }
  ```
- **Behavior**: Validates target is not `SUPER_ADMIN_EMAIL` and not self; checks that at least one Super Admin remains; calls `setCustomUserClaims(uid, { admin: false, superAdmin: false })`, revokes refresh tokens via `revokeRefreshTokens(uid)`, deletes doc `admins/{email}`, appends `audit_logs` record.

#### 3. `POST /api/setSuperAdmin`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "email": "user@vit.ac.in"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Successfully promoted user@vit.ac.in to Super Admin"
  }
  ```
- **Behavior**: Sets custom claims `{ admin: true, superAdmin: true }`, updates `admins/{email}` (`isSuperAdmin: true`), appends `audit_logs` record.

#### 4. `POST /api/removeSuperAdmin`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "email": "user@vit.ac.in"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Successfully demoted user@vit.ac.in to regular Admin"
  }
  ```
- **Behavior**: Ensures at least 1 Super Admin remains; sets custom claims `{ admin: true, superAdmin: false }`, revokes refresh tokens, updates `admins/{email}` (`isSuperAdmin: false`), appends `audit_logs` record.

#### 5. `GET /api/admins`
- **Auth Guard**: `verifyAdmin` middleware
- **Response**:
  ```json
  {
    "admins": [
      {
        "email": "admin@vit.ac.in",
        "isSuperAdmin": true,
        "isRoot": true
      }
    ]
  }
  ```
- **Behavior**: Fetches documents from `admins` collection. If empty, performs automatic initial migration by scanning Firebase Auth user list for `admin === true` custom claims and populates Firestore.

#### 6. `POST /api/admin/users/create`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "email": "newmember@vit.ac.in",
    "tags": ["tag_doc_id_1"],
    "customFields": {}
  }
  ```
- **Response**: `{ "success": true }`
- **Behavior**: Provisions user in `users/{email}` with `status: 'approved_unverified'`, triggers `sendVerificationEmail(email, 'onboarding', { tags })`.

#### 7. `POST /api/admin/requests/approve`
- **Auth Guard**: `verifySuperAdmin` middleware
- **Request Body**:
  ```json
  {
    "requestId": "req_123",
    "email": "applicant@vit.ac.in",
    "name": "John Doe",
    "registrationNumber": "21BCE0001",
    "tags": ["tag_id"],
    "customFields": {}
  }
  ```
- **Response**: `{ "success": true }`
- **Behavior**: Updates `join_requests/{requestId}` status to `'approved_unverified'`, provisions user document, sends onboarding email.

---

### 1.5 UI Components & Admin Interfaces (R3)

1. **`TagsTab.jsx` (`src/components/admin/TagsTab.jsx`)**:
   - Real-time Firestore subscription to `tags` collection ordered by name.
   - Form controls: Tag Name, "Acts as a group" (checkbox), "Grants Admin Access" (checkbox), "Grants Super Admin Access" (checkbox), "Ex-Member Tag" (checkbox), and multi-checkbox group for 1-level auto-granted tags (`grantsTags`).
   - List view showing role badges (`Group`, `Admin`, `Super Admin`, `Ex-Member`, `+N Auto-assigned`) with Edit/Delete handlers.

2. **`TeamMembersTab.jsx` (`src/components/admin/TeamMembersTab.jsx`)**:
   - Main management interface accessible only to Super Admins (`superAdminOnly: true` in `Admin.jsx`).
   - Includes sub-tabs for switching to `TagsTab` or `CustomFieldsTab`.
   - Filter dropdown: Filter by Group (`all`, `untagged`, `archived`, or specific tag ID).
   - "Pending Join Requests" list panel with instant Accept/Reject actions.
   - Member Editor: Checkbox grid of available tags. Interactive toggling executes `handleTagToggle` and `getGrantedTagIds`. On save, expands tags (`expandTagIds`), updates Firestore, and invokes `syncUserPermissions`.

---

## 2. Requirement R4: Social Links Management

### 2.1 Data Schema & Firestore Rules

#### A. Collection: `social_links` (`social_links/{docId}`)

| Field Name | Type | Description | Example |
|---|---|---|---|
| `title` | string | Human-readable label for the social profile/link | `"Instagram"` |
| `url` | string | Absolute HTTP/HTTPS destination URL | `"https://instagram.com/teamrotorfpv"` |
| `icon` | string | Key mapping to brand or generic icon component | `"instagram"`, `"youtube"`, `"github"` |
| `order` | number | Ascending integer for display sorting (lower = first) | `10` |
| `enabled` | boolean | Visibility flag (`true` = visible, `false` = hidden) | `true` |

#### B. Firestore Security Rules
Enforced in `firestore.rules`:
```firestore
match /social_links/{docId} {
  allow read: if true;
  allow create, update, delete: if isAdmin();
}
```
Public read access is unrestricted. Full CRUD operations require Firebase Auth ID token with `admin == true`.

---

### 2.2 Supported Icon Catalog

The system standardizes icon rendering across components via `ICON_OPTIONS` and `ICON_MAP`:

| Icon Key | Label | Source Library | Primary Use Case |
|---|---|---|---|
| `instagram` | Instagram | `react-icons/fa` / `fa6` | Official Instagram Page |
| `youtube` | YouTube | `react-icons/fa` / `fa6` | Channel & Flight Videos |
| `linkedin` | LinkedIn | `react-icons/fa` / `fa6` | Team Corporate & Sponsor Page |
| `github` | GitHub | `react-icons/fa` / `fa6` | Open Source Code & Firmware |
| `twitter` / `x` | Twitter / X | `react-icons/fa6` | Announcements & News |
| `facebook` | Facebook | `react-icons/fa` | Community Page |
| `whatsapp` | WhatsApp | `react-icons/fa` | Community Group |
| `discord` | Discord | `react-icons/fa` | Team Server |
| `telegram` | Telegram | `react-icons/fa6` | Broadcast Channel |
| `spotify` | Spotify | `react-icons/fa` | Podcast / Playlists |
| `twitch` | Twitch | `react-icons/fa` | Live FPV Streams |
| `threads` | Threads | `react-icons/fa6` | Social Posts |
| `mail` / `email` | Email | `lucide-react` | Contact Email |
| `globe` / `website`| Website | `lucide-react` | External Site |
| `link` | Link | `lucide-react` | Generic Link Fallback |
| `shop` / `store` | Shop | `lucide-react` | Merchandise Store |
| `blog` / `document`| Blog / Document | `lucide-react` | Team Documentation |
| `calendar` / `events`| Calendar | `lucide-react` | Race Calendar |
| `team` / `community`| Team | `lucide-react` | Roster / Community |

---

### 2.3 Management UI & CRUD Workflows (`SocialsTab.jsx`)

Located at `src/components/admin/SocialsTab.jsx` within the Admin Dashboard.

1. **Form Interface (Left Column)**:
   - Inputs: Title (`text`), URL (`url`), Icon (`select` dropdown with icon preview box), Order (`number`), Enabled (`checkbox`).
   - Dynamic icon preview resolves `ICON_MAP[formData.icon]` in real-time.
2. **List Interface (Right Column)**:
   - Uses real-time listener: `query(collection(db, 'social_links'), orderBy('order', 'asc'))`.
   - Renders link cards with title, order badge (`#order`), URL text, and status badge (`Hidden` when `enabled === false`).
   - Action controls:
     - **Toggle Visibility** (`Eye` / `EyeOff`): Updates `enabled` field without opening full editor.
     - **Edit**: Populates form with existing document values and sets `editingId`.
     - **Delete**: Prompts confirm dialog and deletes document via `deleteDoc(doc(db, 'social_links', id))`.
   - Logging: Calls `logAdminAction('CREATE'|'UPDATE'|'DELETE', 'SocialLink', details)` to record changes in `activity_logs`.

---

### 2.4 Public Consumption Interfaces

#### A. Main Website Footer (`src/components/Footer.jsx`)
- Executes query on mount: `query(collection(db, 'social_links'), orderBy('order', 'asc'))`.
- Filters out disabled links (`link.enabled !== false`).
- Maps `link.icon.toLowerCase()` against `ICON_MAP`.
- Renders horizontal row of interactive icon anchors:
  ```jsx
  <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.title}>
    <Icon size={20} />
  </a>
  ```

#### B. Dedicated Link-Tree Application (`socials/src/App.jsx`)
- Standalone Vite React app hosted on social sub-domain (`socials.teamrotorfpv.com`).
- Data Fetching: Queries `social_links` ordered by `order`.
- Filters active links (`visibleLinks = links.filter(l => l.enabled !== false)`).
- UX Features:
  - Responsive WebGL background (`Silk` component with Three.js shader).
  - Profile avatar, team title, and tagline header.
  - Skeleton loader fallback during initial Firestore fetch.
  - Interactive full-width link buttons (`.link-btn`) containing icon, label, and trailing arrow (`ChevronRight`).

---

## 3. Summary Matrix of Files & Responsibilities

| File Path | Domain | Key Responsibilities |
|---|---|---|
| `server/index.js` | Backend API | Express entry point, `/api/setAdmin`, `/api/removeAdmin`, `/api/setSuperAdmin`, `/api/removeSuperAdmin`, `/api/admins`, `/api/admin/users/create`, audit logging |
| `server/auth.js` | Auth Middleware | Express auth verification (`verifyAuth`, `verifyAdmin`, `verifySuperAdmin`), client IP extraction |
| `server/migrate_admins_to_tags.js` | Migration Script | Boots tags collection, migrates legacy Auth custom claims into Firestore user profiles |
| `firestore.rules` | Security Rules | Granular Firestore rules for `tags` (admin write), `users` (restricted write), `social_links` (public read, admin write) |
| `src/lib/tagGrants.js` | Permission Logic | 1-level tag expansion (`expandTagIds`), Board tag default grants (`getGrantedTagIds`) |
| `src/lib/adminApi.js` | API & Sync Client | Client HTTP fetch helpers (`apiPost`, `apiGet`), permission sync handler (`syncUserPermissions`), admin logger (`logAdminAction`) |
| `src/components/admin/TagsTab.jsx` | Admin UI (R3) | Tag CRUD interface, permission flags (`grantsAdmin`, `grantsSuperAdmin`), tag link configuration |
| `src/components/admin/TeamMembersTab.jsx` | Admin UI (R3) | Super Admin member roster manager, tag assignment editor, join request processing |
| `src/components/admin/SocialsTab.jsx` | Admin UI (R4) | Social link CRUD panel, ordering, visibility toggle, icon selection preview |
| `src/components/Footer.jsx` | Website UI (R4) | Main site footer rendering enabled social links |
| `socials/src/App.jsx` | Link-Tree App (R4) | Dedicated link tree application consuming `social_links` |

---

## 4. Recommendations & Caveats

1. **Tag Hierarchy Recursion Guard**: `expandTagIds` enforces a strict 1-level depth expansion. If deeper nesting is ever proposed, cyclic reference detection must be added to avoid infinite expansion loops.
2. **Custom Claims Token Latency**: When `syncUserPermissions` promotes or demotes a user via `/api/setAdmin`, Firebase Auth ID tokens remain valid until refreshed or explicitly revoked. `removeAdmin` / `removeSuperAdmin` invoke `revokeRefreshTokens(uid)` on the backend to force token invalidation.
3. **Social Links Icon Fallback**: Client applications (`Footer.jsx`, `socials/src/App.jsx`) fallback gracefully to `LinkIcon` (Lucide React generic link) if an unrecognized `icon` string is encountered.
