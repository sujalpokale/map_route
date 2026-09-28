import { create } from 'zustand';
import { UserProfile, UserRole } from '@/types';
import { apiClient } from '@/services/api/client';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

const DEMO_USER: UserProfile = {
  id: 'usr_sujal_01',
  name: 'Sujal Pokale',
  email: 'sujal@routeintelligence.ai',
  phone: '+91 98765 43210',
  role: 'DRIVER',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  organization: 'AeroRoute Logistics Global',
  total_trips: 142,
  total_distance_km: 3840.5,
  total_fuel_saved_litres: 128.4,
};

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USER,
  token: 'mock_jwt_token_route_intelligence_secure',
  isAuthenticated: true,
  isLoading: false,

  login: async (email: string, role: UserRole = 'DRIVER') => {
    set({ isLoading: true });
    // Simulate login & set auth token
    const token = `token_${Date.now()}`;
    apiClient.setAuthToken(token);
    
    set({
      user: {
        ...DEMO_USER,
        email,
        role,
      },
      token,
      isAuthenticated: true,
      isLoading: false,
    });
    return true;
  },

  logout: () => {
    apiClient.setAuthToken(null);
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateProfile: (partial) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    }));
  },
}));
