import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string, user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (email: string, password: string) => {
        const response = await axios.post('/api/auth/login', { email, password });
        const { token, user } = response.data;
        set({ token, user });
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },
      logout: () => {
        set({ token: null, user: null });
        delete axios.defaults.headers.common['Authorization'];
      },
      setToken: (token: string, user: User) => {
        set({ token, user });
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
