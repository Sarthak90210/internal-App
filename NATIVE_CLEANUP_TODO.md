# Native cleanup — apply on your next rebuild

None of this is applied. All of it is a **native change**, so per `AI_VERSIONING_RULES.md` doing any of it means:

- bump `runtimeVersion` `2` → `3`
- bump `version` `2.2.0` → `3.0.0` (reset the minor)
- rebuild the APK — **these cannot ship over OTA**

The JS-only fixes already applied kept runtime `2` and moved version to `2.2.0`, so they *are* OTA-deployable to existing V2.x installs.

---

## 1. Remove expo-router (the app doesn't use it)

`package.json` `main` is `node_modules/expo/AppEntry.js` and the app boots `App.js` → React Navigation. expo-router is dead weight that still ships native config.

**`app.json`** — remove from `plugins`:
```json
"expo-router",
```
Remove the whole `experiments` block (both keys are router-related):
```json
"experiments": { "typedRoutes": true, "reactCompiler": true },
```
> Note: `reactCompiler` is independent of the router. If you want to keep the React Compiler, keep `experiments` with only that key.

Remove from `extra`:
```json
"router": {},
```

**Delete:** `expo-env.d.ts`, `.expo/types/router.d.ts`

**`package.json`** — remove `"expo-router": "~6.0.24"`

---

## 2. Remove unused dependencies

Zero direct imports anywhere in `src/` or `App.js`:

```
@react-native-community/netinfo
expo-auth-session
expo-crypto
expo-device
expo-font
expo-glass-effect
expo-image
expo-linking
expo-web-browser
expo-router
```

**Keep these** even though nothing imports them directly — they're config- or peer-driven:
- `expo-dev-client` (dev build runtime)
- `expo-splash-screen` (configured as a plugin in `app.json`)
- `expo-system-ui` (autolinked, drives root view background)
- `react-native-worklets` (peer of react-native-reanimated 4.x)

**Verify before removing** `react-dom` / `react-native-web`: `app.json` has a `web` block and `package.json` has a `web` script. If you still export for web (`npm run web`, or the `dist/` folder you're generating), keep both.

After removing, run `npx expo install --fix` to resolve version drift, then rebuild.

---

## 3. Fix the runtimeVersion mismatch

Currently the two platforms resolve to **different** runtimes, so an OTA update built for one can't be served to the other:

```json
"ios":     { "runtimeVersion": { "policy": "appVersion" } }   // resolves to "2.2.0"
"android": { "runtimeVersion": "2" }                          // literal "2"
```

`AI_VERSIONING_RULES.md` says runtime = the major integer. Make both literal and identical:

```json
"ios":     { "runtimeVersion": "3" },
"android": { "runtimeVersion": "3" }
```

---

## 4. Security / config

- **`usesCleartextTraffic: true`** is in the release manifest. It's presumably there for the `http://localhost:3000` fallback in `adminApi.js:4`. Once `EXPO_PUBLIC_API_URL` points at an HTTPS endpoint in production, drop this flag.
- **Hardcoded Google OAuth client IDs** in `src/screens/LoginScreen.js:9-10` as `||` fallbacks. They're in `.env` already — delete the literals so a missing env var fails loudly instead of silently authenticating against the baked-in project.
- **`"scheme": "app"`** is the generic default. If you ever add deep links or OAuth redirects, make it something unique like `rfv`.

---

## 5. Housekeeping (not native, just noise)

- **`APK Builds/` is ~480 MB** of four checked-in APKs inside the project folder. It's gitignored, but it's still in every folder scan, backup, and editor index. Move it outside the repo.
- **`.agents/`** — 19 markdown files of leftover multi-agent scaffolding (BRIEFING / handoff / progress / ORIGINAL_REQUEST across 5 agents).
- **`scripts/reset-project.js`** — stock Expo template script wired to `npm run reset-project`. If run, it moves `src/` and `scripts/` into `example/` and scaffolds a blank expo-router app. Delete it and the script entry.
- **`EXPO_PUBLIC_SUPER_ADMIN_EMAIL`** in `.env` is read nowhere in the codebase.
- **149 hardcoded hex colors** across screens bypass `appColors` — `#8B5CF6` is `appColors.accent`, `#EF4444` is `appColors.danger`. Worth a pass when you're next in those files.
