import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  roles: {
    admin: false,
    inventory: false,
    board: false,
    media: false,
  },
  isLoading: true,
  
  setUser: (user) => set({ user }),
  
  setRoles: (roles) => set({ 
    roles: {
      admin: !!roles?.admin,
      inventory: !!roles?.inventory,
      board: !!roles?.board,
      media: !!roles?.media,
    }
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  hasPermission: (permissionName) => {
    const { roles } = get();
    // Admin has all permissions
    if (roles.admin) return true;
    return !!roles[permissionName];
  },
  
  logout: () => set({ 
    user: null, 
    roles: { admin: false, inventory: false, board: false, media: false } 
  }),
}));
