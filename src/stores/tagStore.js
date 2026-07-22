import { create } from 'zustand';
import { TagsService } from '../services/tags';

export const useTagStore = create((set) => ({
  tags: [],
  loading: false,
  initialized: false,
  unsubscribe: null,

  initTags: () => {
    set((state) => {
      if (state.initialized) return state; // Only initialize once
      
      set({ loading: true });
      const unsub = TagsService.subscribeToTags((data) => {
        set({ tags: data, loading: false, initialized: true });
      });
      return { unsubscribe: unsub };
    });
  },

  cleanup: () => {
    set((state) => {
      if (state.unsubscribe) {
        state.unsubscribe();
      }
      return { tags: [], initialized: false, unsubscribe: null };
    });
  }
}));
