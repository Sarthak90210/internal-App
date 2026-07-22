import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const CustomFieldsService = {
  subscribeToFields: (callback) => {
    const q = query(collection(db, 'custom_fields'), orderBy('key', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  addOrUpdateField: async (key, value, userEmail) => {
    const dataToSave = {
      key,
      value,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };
    
    // Using setDoc on the key so the document ID is the key itself, which makes lookups easier
    await setDoc(doc(db, 'custom_fields', key), dataToSave);
    await logAdminAction('UPDATE', 'CustomField', `Updated custom field: ${key}`);
  },

  deleteField: async (id) => {
    await deleteDoc(doc(db, 'custom_fields', id));
    await logAdminAction('DELETE', 'CustomField', `Deleted custom field: ${id}`);
  }
};
