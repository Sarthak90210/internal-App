import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const getIdToken = async () => {
  if (!auth.currentUser) {
    throw new Error('Not authenticated. Please sign in again.');
  }
  return await auth.currentUser.getIdToken();
};

export async function apiPost(path, body) {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function uploadFile(fileUri, folder) {
  const idToken = await getIdToken();
  
  // React Native fetch with FormData needs specific format for file uploads
  const form = new FormData();
  
  // Get filename from URI
  const filename = fileUri.split('/').pop();
  
  // Infer type
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image`;

  form.append('image', {
    uri: fileUri,
    name: filename,
    type,
  });
  
  if (folder) form.append('folder', folder);
  
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'multipart/form-data',
    },
    body: form,
  });
  
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function deleteCloudinaryImage(url) {
  if (!url || !url.includes('res.cloudinary.com')) return;
  try {
    const { ok, data } = await apiPost('/api/delete-asset', { url });
    if (!ok) {
      throw new Error(data.error || 'Cloudinary delete failed');
    }
  } catch (error) {
    console.error('deleteCloudinaryImage error:', error);
  }
}

export async function moveCloudinaryImage(url, toFolder) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  try {
    const { ok, data } = await apiPost('/api/move-asset', { url, toFolder });
    if (ok && data.secure_url) return data.secure_url;
    return url;
  } catch (error) {
    console.error('moveCloudinaryImage error:', error);
    return url;
  }
}

export async function apiGet(path) {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function logAdminAction(actionType, targetType, details) {
  try {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'activity_logs'), {
      userEmail: auth.currentUser.email,
      actionType,
      targetType,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
