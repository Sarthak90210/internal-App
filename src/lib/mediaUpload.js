import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../services/adminApi';

// ── Cloudinary folder naming ──────────────────────────────────────────────
// The server strips caller-supplied folders down to [a-zA-Z0-9/_-] and then,
// for non-admins, requires the result to equal their own profile folder.
// Deriving a folder from user data without this sanitiser is what broke
// profile-picture uploads: `users/someone@vit.ac.in` arrived as
// `users/someonevitacin` and no longer matched.
//
// Keep in sync with sanitizeFolder()/ownProfileFolder() in the backend
// (Team-RotorFPV-Website/server/index.js).
export const sanitizeFolder = (folder) =>
  (folder || '').replace(/[^a-zA-Z0-9/_-]/g, '');

/**
 * The one folder a non-admin is permitted to upload into.
 */
export const ownProfileFolder = (email) =>
  `users/${sanitizeFolder((email || '').toLowerCase())}`;

/**
 * Build a folder path from arbitrary segments, sanitising each one.
 * e.g. buildFolder('events', 'Upcoming', 'Drone Race 2026')
 *      -> 'events/Upcoming/Drone-Race-2026'
 */
export const buildFolder = (...segments) =>
  segments
    .filter(Boolean)
    .map(seg =>
      sanitizeFolder(String(seg).trim().replace(/\s+/g, '-'))
        // Dropped punctuation leaves runs of '-' behind ("Acme Corp. & Co"
        // -> "Acme-Corp--Co"), so collapse and trim them for tidy folders.
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');

/**
 * Normalises every possible outcome of an upload into one shape:
 *   { ok: boolean, url: string|null, width, height, publicId, resourceType, error: string|null }
 *
 * Callers previously each destructured the raw response differently and
 * hand-rolled their own error strings; several read fields that were never
 * returned. Going through this function means a caller cannot misread the
 * response shape.
 */
export const uploadMedia = async (uri, folder) => {
  if (!uri) {
    return { ok: false, url: null, error: 'No file selected.' };
  }

  const safeFolder = sanitizeFolder(folder);

  try {
    const { ok, data } = await uploadFile(uri, safeFolder);

    if (ok && data?.secure_url) {
      return {
        ok: true,
        url: data.secure_url,
        width: data.width ?? null,
        height: data.height ?? null,
        publicId: data.public_id ?? '',
        resourceType: data.resource_type ?? 'image',
        error: null,
      };
    }

    return {
      ok: false,
      url: null,
      error: data?.error || 'The server rejected the upload. Please try again.',
    };
  } catch (err) {
    // Network failure, timeout, unauthenticated, malformed JSON, etc.
    return {
      ok: false,
      url: null,
      error: err?.message || 'Could not reach the server. Check your connection.',
    };
  }
};

/**
 * Launch the picker and upload in one step.
 * Returns { ok, url, canceled, error, ... } — `canceled: true` means the user
 * backed out and is NOT an error, so callers should stay silent on it.
 */
export const pickAndUploadMedia = async ({
  folder,
  mediaTypes = ['images'],
  allowsEditing = true,
  aspect = [1, 1],
  quality = 0.8,
} = {}) => {
  let result;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing,
      aspect,
      quality,
    });
  } catch (err) {
    return { ok: false, canceled: false, url: null, error: err?.message || 'Could not open the media library.' };
  }

  const asset = result?.assets?.[0];
  if (result?.canceled || !asset?.uri) {
    return { ok: false, canceled: true, url: null, error: null };
  }

  const uploaded = await uploadMedia(asset.uri, folder);
  return { ...uploaded, canceled: false };
};
