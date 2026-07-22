import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCloudinaryImage, logAdminAction } from './adminApi';

export const DronesService = {
  subscribeToDrones: (callback) => {
    const q = query(collection(db, 'drones'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  addDrone: async (droneData, userEmail) => {
    const dataToSave = {
      ...droneData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'drones'), dataToSave);
    await logAdminAction('CREATE', 'Drone', `Added drone: ${droneData.name}`);
    return docRef;
  },

  updateDrone: async (id, oldItem, newItemData, userEmail) => {
    const dataToSave = {
      ...newItemData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };

    if (oldItem && oldItem.image && oldItem.image !== newItemData.image) {
      await deleteCloudinaryImage(oldItem.image);
    }

    await updateDoc(doc(db, 'drones', id), dataToSave);
    await logAdminAction('UPDATE', 'Drone', `Updated drone: ${newItemData.name}`);
  },

  deleteDrone: async (item) => {
    await deleteDoc(doc(db, 'drones', item.id));
    if (item.image) {
      await deleteCloudinaryImage(item.image);
    }
    await logAdminAction('DELETE', 'Drone', `Deleted drone: ${item.name}`);
  }
};
