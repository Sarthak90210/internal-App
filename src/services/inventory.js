import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const InventoryService = {
  subscribeToLists: (callback) => {
    const q = query(collection(db, 'inventory_lists'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error("Error subscribing to lists:", error);
    });
  },

  subscribeToInventories: (listId, callback) => {
    const q = query(collection(db, 'inventories'), where('listId', '==', listId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory if needed
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(data);
    });
  },

  subscribeToSubInventories: (inventoryId, callback) => {
    const q = query(collection(db, 'inventories'), where('parentInventoryId', '==', inventoryId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(data);
    });
  },

  subscribeToItems: (inventoryId, callback) => {
    const q = query(collection(db, 'items'), where('inventoryId', '==', inventoryId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  addList: async (name) => {
    return addDoc(collection(db, 'inventory_lists'), {
      name,
      createdAt: serverTimestamp()
    });
  },

  addInventory: async (listId, name) => {
    return addDoc(collection(db, 'inventories'), {
      listId,
      name,
      createdAt: serverTimestamp()
    });
  },

  addItem: async (inventoryId, itemData) => {
    return addDoc(collection(db, 'items'), {
      inventoryId,
      ...itemData,
      createdAt: serverTimestamp()
    });
  },

  subscribeToHistory: (inventoryId, callback) => {
    const q = query(collection(db, 'inventory_history'), where('inventoryId', '==', inventoryId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() }));
      callback(data);
    });
  },

  subscribeToAllInventories: (callback) => {
    const q = query(collection(db, 'inventories'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  getAllItems: async () => {
    const q = query(collection(db, 'items'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};
