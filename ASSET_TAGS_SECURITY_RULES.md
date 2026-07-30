# Firestore Security Rules — `asset_tags`

> ✅ **DEPLOYED 2026-07-30** to project `teamrotor-fpv-website`. The live source of
> truth is the sibling website repo `../WEBSITE/Team-RotorFPV-Website/firestore.rules`.
> The deployed version gates `asset_tags` to the existing **`isInventoryAdmin()`**
> helper (admin/superAdmin/inventory) to match `inventories`/`items`, rather than the
> bare `signedIn()` shown in the example below. Redeploy with:
> `cd ../WEBSITE/Team-RotorFPV-Website && npx firebase-tools deploy --only firestore:rules --project teamrotor-fpv-website`


These rules are the **real** enforcement of the tag lifecycle. The client checks in
`src/services/assetTags.js` give good UX and catch the common cases, but only the
rules can stop a malicious or offline-racing client from breaking the invariants:

- A tag is **bound once, permanently** — `entityId`/`entityType` can never change
  once set.
- Lifecycle is strictly `unassigned → active → retired`. No other transition.
- Tags are **never deleted** (retired instead).
- **Minting** and **retiring** require the `inventory` role (custom claim); anyone
  signed in may **bind** and **hold** (product decision).

This also resolves the one genuine offline conflict: if two devices both bind the
same unassigned tag while offline, the first write to reach the server flips
`status` to `active`; the second syncs later, fails the `status == 'unassigned'`
precondition, and is rejected — **first-to-server wins**.

Roles are Firebase Auth **custom claims** (see `src/services/auth.js`), so rules
read `request.auth.token.inventory` / `.admin` / `.superAdmin`.

## Merge this into the project's Firestore rules

> ⚠️ The project's other collection rules are managed elsewhere (Firebase console
> / CLI). Paste the `match /asset_tags/{code}` block and the helper functions into
> the existing `service cloud.firestore { match /databases/{database}/documents { … } }`
> — do **not** deploy this file standalone or it will wipe the other rules.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function hasInventory() {
      return signedIn() && (
        request.auth.token.inventory == true ||
        request.auth.token.admin == true ||
        request.auth.token.superAdmin == true
      );
    }

    match /asset_tags/{code} {
      // Bind: unassigned -> active. Any signed-in user may bind.
      function isBindTransition() {
        return resource.data.status == 'unassigned'
          && request.resource.data.status == 'active'
          && request.resource.data.entityId != null
          && (request.resource.data.entityType == 'inventory'
              || request.resource.data.entityType == 'item');
      }

      // Retire: active -> retired. Inventory role only. Binding stays immutable.
      function isRetireTransition() {
        return hasInventory()
          && resource.data.status == 'active'
          && request.resource.data.status == 'retired'
          && request.resource.data.entityId == resource.data.entityId
          && request.resource.data.entityType == resource.data.entityType;
      }

      allow read: if signedIn();

      // Mint: inventory role; must start unassigned and unbound.
      allow create: if hasInventory()
        && request.resource.data.status == 'unassigned'
        && request.resource.data.entityId == null
        && request.resource.data.entityType == null;

      allow update: if signedIn() && (isBindTransition() || isRetireTransition());

      // Retired, never deleted.
      allow delete: if false;
    }
  }
}
```

## Note on item custody (`items.currentHolder`)

Adding `currentHolder` / `currentHolderSince` to `items` needs no new rule beyond
whatever already governs the `items` collection: holding is open to any signed-in
user (same policy as the existing folder `assignHolder`). If you later restrict
custody changes, gate writes to those two fields with a check analogous to
`hasInventory()`.
