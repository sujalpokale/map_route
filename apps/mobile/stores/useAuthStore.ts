import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { UserProfile } from '@/types';
import { apiClient } from '@/services/api/client';
import { AccountSubscription, AccountUser, authApi } from '@/services/api/auth';
import { useVehicleStore } from './useVehicleStore';

const TOKEN_KEY = 'route-intelligence.access-token';

interface AuthState {
  user: UserProfile | null;
  account: AccountUser | null;
  subscription: AccountSubscription | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; phone?: string }) => Promise<boolean>;
  clearError: () => void;
}

function profileFromAccount(account: AccountUser): UserProfile {
  return {
    id: account.user_id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    role: account.role === 'admin' ? 'ADMIN' : 'USER',
    total_trips: 0,
    total_distance_km: 0,
    total_fuel_saved_litres: 0,
  };
}

async function saveToken(token: string | null) {
  if (Platform.OS === 'web') return;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function responseError(response: { error: string | null }) {
  return response.error || 'Unable to complete the request.';
}

async function installSession(session: { access_token: string; user: AccountUser }, set: (value: Partial<AuthState>) => void) {
  await saveToken(session.access_token);
  apiClient.setAuthToken(session.access_token);
  const [subResponse, preferencesResponse] = await Promise.all([
    authApi.getSubscription(),
    authApi.getPreferences(),
  ]);
  applyVehicleSettings(preferencesResponse.data?.vehicle_settings, preferencesResponse.data?.selected_vehicle_id);
  set({
    token: session.access_token,
    account: session.user,
    user: profileFromAccount(session.user),
    subscription: subResponse.data,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

function applyVehicleSettings(value: unknown, selectedVehicleId?: unknown) {
  const store = useVehicleStore.getState();
  store.resetVehicles();
  if (typeof selectedVehicleId === 'string' && store.vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
    store.selectVehicle(selectedVehicleId);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const update = useVehicleStore.getState().updateVehicleEconomics;
  for (const [id, settings] of Object.entries(value)) {
    if (!settings || typeof settings !== 'object') continue;
    const economics = settings as { efficiency_kmpl?: unknown; fuel_price_inr?: unknown };
    if (typeof economics.efficiency_kmpl === 'number' && typeof economics.fuel_price_inr === 'number') {
      update(id, economics.efficiency_kmpl, economics.fuel_price_inr);
    }
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  account: null,
  subscription: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  restoreSession: async () => {
    if (Platform.OS === 'web') {
      set({ isLoading: false });
      return;
    }
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        useVehicleStore.getState().resetVehicles();
        set({ isLoading: false });
        return;
      }
      apiClient.setAuthToken(token);
      const response = await authApi.getCurrentUser();
      if (!response.data) throw new Error(response.error || 'Saved session expired');
      const account = response.data;
      const [subResponse, preferencesResponse] = await Promise.all([
        authApi.getSubscription(),
        authApi.getPreferences(),
      ]);
      applyVehicleSettings(preferencesResponse.data?.vehicle_settings, preferencesResponse.data?.selected_vehicle_id);
      set({ token, account, user: profileFromAccount(account), subscription: subResponse.data, isAuthenticated: true, isLoading: false });
    } catch {
      await saveToken(null);
      apiClient.setAuthToken(null);
      useVehicleStore.getState().resetVehicles();
      set({ user: null, account: null, subscription: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshSubscription: async () => {
    if (!get().token) return;
    const response = await authApi.getSubscription();
    if (response.data) set({ subscription: response.data });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const response = await authApi.login({ email: email.trim().toLowerCase(), password });
    if (!response.data) {
      set({ isLoading: false, error: responseError(response) });
      return false;
    }
    try {
      await installSession(response.data, set);
      return true;
    } catch {
      set({ isLoading: false, error: 'Signed in but could not securely save the session on this device.' });
      return false;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    const response = await authApi.register({ ...data, email: data.email.trim().toLowerCase() });
    if (!response.data) {
      set({ isLoading: false, error: responseError(response) });
      return false;
    }
    try {
      await installSession(response.data, set);
      return true;
    } catch {
      set({ isLoading: false, error: 'Account created but could not securely save the session on this device.' });
      return false;
    }
  },

  logout: async () => {
    try {
      if (get().token) await authApi.logout();
    } finally {
      await saveToken(null);
      apiClient.setAuthToken(null);
      useVehicleStore.getState().resetVehicles();
      set({ user: null, account: null, subscription: null, token: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  updateProfile: async (data) => {
    const response = await authApi.updateProfile(data);
    if (!response.data) {
      set({ error: responseError(response) });
      return false;
    }
    set({ account: response.data, user: profileFromAccount(response.data), error: null });
    return true;
  },

  clearError: () => set({ error: null }),
}));
