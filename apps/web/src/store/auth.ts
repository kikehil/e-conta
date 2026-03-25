import { create } from 'zustand';

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'BILLER' | 'HR';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  companyId: string | null;
  role: Role | null;
  login: (token: string, companyId: string, role?: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  companyId: null,
  role: null,
  login: (token, companyId, role = 'ADMIN') => set({ isAuthenticated: true, token, companyId, role }),
  logout: () => set({ isAuthenticated: false, token: null, companyId: null, role: null })
}));
