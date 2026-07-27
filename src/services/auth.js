import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../stores/authStore';
import { Alert } from 'react-native';

/**
 * Read custom claims off a signed-in user and confirm they are still an
 * active, non-archived member. Shared by the sign-in path and the auth
 * listener so the two can't drift apart.
 */
const resolveAuthorization = async (user) => {
  const idTokenResult = await user.getIdTokenResult();
  const claims = idTokenResult.claims;
  const hasAdminClaim = !!(claims.admin || claims.superAdmin);

  const userDocRef = doc(db, 'users', user.email.toLowerCase());
  const userDoc = await getDoc(userDocRef);
  const isActiveMember =
    userDoc.exists() &&
    userDoc.data().isActive !== false &&
    userDoc.data().isArchived !== true;

  return { claims, authorized: hasAdminClaim || isActiveMember };
};

const applyRoles = (user, claims) => {
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setRoles({
    admin: claims.admin,
    superAdmin: claims.superAdmin,
    inventory: claims.inventory,
    board: claims.board,
    media: claims.media,
  });
};

export const AuthService = {
  signInWithGoogleToken: async (idToken) => {
    try {
      useAuthStore.getState().setLoading(true);
      const googleCredential = GoogleAuthProvider.credential(idToken);
      
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;

      const { claims, authorized } = await resolveAuthorization(user);

      if (!authorized) {
        await signOut(auth);
        throw new Error('Access Denied: You are not an authorized team member.');
      }

      applyRoles(user, claims);
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
          const { claims, authorized } = await resolveAuthorization(user);

          if (!authorized) {
            await signOut(auth);
            Alert.alert('Access Denied', 'You are not an authorized team member.');
            useAuthStore.getState().logout();
          } else {
            applyRoles(user, claims);
          }
        } catch (err) {
          // A network or cache failure here must not sign the user out — they
          // would be booted every time the app opens offline. Keep the session
          // and let the next successful check settle it.
          console.warn('Could not verify user status, keeping existing session:', err);
          useAuthStore.getState().setUser(user);
        }
      } else {
        useAuthStore.getState().logout();
      }
      useAuthStore.getState().setLoading(false);
    });
  }
};
