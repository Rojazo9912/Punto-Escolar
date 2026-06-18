import { create } from 'zustand';

export interface Permission {
  id: number;
  name: string;
  description: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: Permission[];
}

export interface User {
  id: number;
  username: string;
  roleId: number;
  active: boolean;
  role: Role;
  token?: string;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
  getToken: () => string | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: (() => {
    const saved = localStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  })(),
  isAuthenticated: localStorage.getItem('user_session') !== null,
  login: (user) => {
    localStorage.setItem('user_session', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('user_session');
    set({ user: null, isAuthenticated: false });
  },
  hasPermission: (permissionName) => {
    const user = get().user;
    if (!user) return false;
    // Administrador siempre tiene todos los accesos
    if (user.role.name === 'Administrador') return true;
    return user.role.permissions.some(p => p.name === permissionName);
  },
  getToken: () => {
    return get().user?.token || null;
  }
}));
