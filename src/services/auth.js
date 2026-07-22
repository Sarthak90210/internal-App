import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuthStore } from '../stores/authStore';

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
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setRoles({
        admin: claims.admin,
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
        useAuthStore.getState().setUser(user);
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims;
        useAuthStore.getState().setRoles({
          admin: claims.admin,
          inventory: claims.inventory,
          board: claims.board,
          media: claims.media,
        });
      } else {
        useAuthStore.getState().logout();
      }
      useAuthStore.getState().setLoading(false);
    });
  }
};
