# Profile picture upload — root cause & fix

## ⚠️ The real fix is on the server. Deploy it, or profile uploads stay broken.

Changed file: `WEBSITE/Team-RotorFPV-Website/server/index.js` (`/api/upload`).
The mobile-app changes alone are **not** sufficient — see "Why the app couldn't fix this alone" below.

---

## Root cause

`/api/upload` sanitised the caller-supplied folder, then compared it against an **unsanitised** email:

```js
// before
const safeFolder = (req.body.folder || '').replace(/[^a-zA-Z0-9/_-]/g, '');

if (!req.user.admin) {
  if (safeFolder !== `users/${req.user.email.toLowerCase()}`) {
    return res.status(403).json({ error: 'Forbidden: You can only upload to your own profile folder' });
  }
}
```

The sanitiser strips everything outside `[a-zA-Z0-9/_-]` — which includes **`@` and `.`**, the two characters every email contains.

For `teamrotorfpv@vit.ac.in`:

| | value |
|---|---|
| App sent | `users/teamrotorfpv@vit.ac.in` |
| After `safeFolder` | `users/teamrotorfpvvitacin` |
| Compared against | `users/teamrotorfpv@vit.ac.in` |
| Result | never equal → **403** |

The file uploaded fine (multer buffers it before this check runs), *then* the request was rejected — which is exactly why it looked like "an error after uploading".

### Why nobody caught it
The check is inside `if (!req.user.admin)`. **Admins skip it entirely.** Anyone testing with an admin account saw uploads work perfectly. It failed for every non-admin, 100% of the time.

The website has the same defect, but its profile editor lives in an admin-only tab (`src/components/admin/ProfileTab.jsx:136`), so it never surfaced there. The mobile app exposes profile editing to all users, which is what made it visible.

### Why the app couldn't fix this alone
No value the client sends can satisfy the old check. The right-hand side (`users/${raw email}`) contains `@` and `.`, and the left-hand side has been stripped of them — so the two can never match, whatever the client does. The comparison itself had to change.

---

## The fix

**Server** — both sides now go through the same helpers:

```js
const sanitizeFolder = (folder) => (folder || '').replace(/[^a-zA-Z0-9/_-]/g, '');
const ownProfileFolder = (email) => `users/${sanitizeFolder((email || '').toLowerCase())}`;

const safeFolder = sanitizeFolder(req.body.folder);
if (!req.user.admin && safeFolder !== ownProfileFolder(req.user.email)) {
  return res.status(403).json({ error: 'Forbidden: You can only upload to your own profile folder' });
}
```

Note this does not loosen the permission check — a non-admin still reaches exactly one folder. It only makes both sides agree on what that folder is called.

**App** — `src/lib/mediaUpload.js` exports `sanitizeFolder` / `ownProfileFolder` / `buildFolder` that mirror the server's rules, so a folder built on the client is already server-safe.

---

## Hardening — so this class of bug can't recur

The underlying problem was **eight hand-rolled copies** of pick-file → upload → read-response, each with its own folder construction, its own response destructuring, and its own error strings. One of them was wrong.

All eight now go through `src/lib/mediaUpload.js`:

| | |
|---|---|
| `sanitizeFolder(folder)` | mirrors the server's character rule |
| `ownProfileFolder(email)` | the one folder a non-admin may write to |
| `buildFolder(...segments)` | safe path from arbitrary user input (spaces → `-`, punctuation dropped, `-` runs collapsed) |
| `uploadMedia(uri, folder)` | normalises **every** outcome to `{ ok, url, width, height, publicId, error }` |
| `pickAndUploadMedia({...})` | picker + upload; returns `canceled: true` (not an error) when the user backs out |

Migrated call sites: ProfileScreen, ManageAchievements, ManageEvents, ManageGallery (×2), ManageSponsors (×2), ManageHomeSettings.
`uploadFile` now has exactly **one** caller in the whole codebase.

Incidental fixes made while migrating:
- A cancelled picker no longer falls through to an error path in several screens.
- Network failures now say "Could not reach the server. Check your connection." instead of surfacing a raw exception message or nothing at all.
- `ProfileScreen.handleSave` coerced every field before `.trim()` — saving before the Firestore snapshot hydrated used to throw `Cannot read property 'trim' of undefined`.
- `handlePickImage` now bails out with a clear message if the session has expired, rather than dereferencing `authUser.email`.

---

## Tests

Three regression tests in `tests/test_services.js` pin the client to the server's rules — including one that asserts the *old* construction fails, so the bug can't silently return:

```
✓ mediaUpload sanitizeFolder matches the server sanitiser
✓ mediaUpload ownProfileFolder survives server sanitisation (403 regression)
✓ mediaUpload buildFolder strips unsafe characters from user input
```

**Suite: 33/33 passing** (was 30).

### Two harness bugs fixed along the way
- **`lucide-react-native` was never mocked.** Every screen imports it, and the real package is a barrel over ~1600 icon modules. The screens suite was loading all of them, which pushed a cold run past 42s and made it look like a hang. A `Proxy` mock now returns a component for any icon name, so new icons never need registering. Full run: **timing out → 32s cold, 13s warm.**
- **Babel transform cache** added to `tests/setup.js`, keyed by content hash (so edits self-invalidate) and written to `node_modules/.cache/rfv-tests`.

---

## Deploy checklist

1. **Deploy the server** (`Team-RotorFPV-Website/server/index.js`) — nothing else matters until this ships.
2. Ship the app JS. No native change, so runtime stays **2** and this rides an OTA update.
3. Verify with a **non-admin** account — an admin account will pass either way and tells you nothing.

Optional follow-up: apply the same `ownProfileFolder` helper to the website's `ProfileTab.jsx:136`, which still builds `users/${user.email}` by hand. It works today only because that tab is admin-gated.
