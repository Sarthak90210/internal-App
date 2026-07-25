import { create } from 'zustand';
import * as Updates from 'expo-updates';

export const useUpdateStore = create((set, get) => ({
  isUpdateAvailable: false,
  isChecking: false,
  isDownloading: false,
  error: null,
  notice: null,

  checkForUpdate: async (isManual = false) => {
    set({ isChecking: true, error: null, notice: null });
    
    // In dev mode or when Expo Updates is not enabled (e.g. Expo Go or Dev Client connected to Metro)
    if (__DEV__ || !Updates.isEnabled) {
      if (isManual) {
        console.log('[UpdateStore] Manual update check skipped: Expo Updates is not supported in Development Mode or Expo Go.');
        set({ 
          notice: 'Notice: Over-the-air update checks are disabled in Development builds and Expo Go. Live updates run in production release builds.',
          isChecking: false 
        });
      } else {
        // Silently skip background check without spamming console logs
        set({ isChecking: false });
      }
      return;
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        set({ isUpdateAvailable: true });
      } else if (isManual) {
        set({ notice: 'You are already running the latest version of RFV.' });
      }
    } catch (err) {
      const errMsg = String(err.message || err);
      if (errMsg.includes('not supported in development builds') || errMsg.includes('not enabled') || errMsg.includes('Expo Go')) {
        if (isManual) {
          console.log('[UpdateStore] Update check skipped in dev build:', errMsg);
          set({ notice: 'Notice: Over-the-air update checks are not supported in Development builds or Expo Go. Test in an EAS Release or Preview build.' });
        }
      } else {
        console.error('[UpdateStore] Error checking for updates:', err);
        if (isManual) {
          set({ error: `Failed to check for updates: ${errMsg}` });
        }
      }
    } finally {
      set({ isChecking: false });
    }
  },

  downloadAndReload: async () => {
    if (__DEV__ || !Updates.isEnabled) {
      set({ isUpdateAvailable: false, notice: 'Notice: Over-the-air updates cannot be applied in Development builds or Expo Go.' });
      return;
    }

    set({ isDownloading: true, error: null });
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      const errMsg = String(err.message || err);
      if (errMsg.includes('not supported in development builds') || errMsg.includes('not enabled') || errMsg.includes('Expo Go')) {
        set({ isDownloading: false, isUpdateAvailable: false, notice: 'Notice: Over-the-air updates cannot be applied in Development builds or Expo Go.' });
      } else {
        console.error('[UpdateStore] Error downloading/reloading update:', err);
        set({ 
          isDownloading: false, 
          error: `Failed to download and apply update: ${errMsg}` 
        });
      }
    }
  },

  dismissPrompt: () => set({ isUpdateAvailable: false }),
  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),
}));
