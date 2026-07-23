import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../stores/authStore';
import { Alert } from 'react-native';
export const AuthService = {
  signInWithGoogleToken: async (idToken) => {
    try {
      useAuthStore.getState().setLoading(true);
      const googleCredential = GoogleAuthProvider.credential(idToken);
      
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;
      
      // Fetch custom claims to determine roles
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      const hasAdminClaim = claims.admin || claims.superAdmin;
      const userDocRef = doc(db, 'users', user.email.toLowerCase());
      const userDoc = await getDoc(userDocRef);
      const isAuthorizedUser = userDoc.exists() && userDoc.data().isActive !== false && userDoc.data().isArchived !== true;

      if (!hasAdminClaim && !isAuthorizedUser) {
        await signOut(auth);
        throw new Error('Access Denied: You are not an authorized team member.');
      }
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setRoles({
        admin: claims.admin,
        superAdmin: claims.superAdmin,
        inventory: claims.inventory,
        board: claims.board,
        media: claims.media,
      });
      
      return user;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  },

  logout: async () => {
    try {
      useAuthStore.getState().setLoading(true);
      await signOut(auth);
      useAuthStore.getState().logout();
    } catch (error) {
      console.error('Logout Error:', error);
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  },
  
  initializeAuthListener: () => {
    return auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const claims = idTokenResult.claims;
          const hasAdminClaim = claims.admin || claims.superAdmin;

          const userDocRef = doc(db, 'users', user.email.toLowerCase());
          const userDoc = await getDoc(userDocRef);
          const isAuthorizedUser = userDoc.exists() && userDoc.data().isActive !== false && userDoc.data().isArchived !== true;

          if (!hasAdminClaim && !isAuthorizedUser) {
            await signOut(auth);
            Alert.alert('Access Denied', 'You are not an authorized team member.');
            useAuthStore.getState().logout();
          } else {
            useAuthStore.getState().setUser(user);
            useAuthStore.getState().setRoles({
              admin: claims.admin,
              superAdmin: claims.superAdmin,
              inventory: claims.inventory,
              board: claims.board,
              media: claims.media,
            });
          }
        } catch (err) {
          console.error('Error verifying user status:', err);
          await signOut(auth);
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
      useAuthStore.getState().setLoading(false);
    });
  }
};
