import { create } from 'zustand';

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'BILLER' | 'HR' | null;

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  companyId: string | null;
  role: Role;
  userName: string;
  companyName: string;
  loginState: (token: string, companyId: string, role: string, userName: string, companyName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  companyId: null,
  role: null,
  userName: '',
  companyName: '',
  
  loginState: (token, companyId, role, userName, companyName) => {
    localStorage.setItem('conta_token', token);
    set({ isAuthenticated: true, token, companyId, role: role as Role, userName, companyName });
  },

  logout: () => {
    localStorage.removeItem('conta_token');
    set({ isAuthenticated: false, token: null, companyId: null, role: null, userName: '', companyName: '' });
  }
}));
