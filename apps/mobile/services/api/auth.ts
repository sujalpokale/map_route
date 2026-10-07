import { apiClient } from './client';
import { Platform } from 'react-native';

export interface AccountUser {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  role: string;
  created_at: string;
  subscription?: { plan: string; status: string };
}

export interface AuthSession {
  access_token: string;
  token_type: 'bearer';
  user: AccountUser;
}

export interface AccountSubscription {
  subscription_id: string;
  plan: 'free' | 'premium';
  billing_cycle: 'monthly' | 'yearly' | null;
  status: string;
  start_date: string;
  expiry_date: string | null;
  days_remaining: number | null;
}

const deviceMeta = { platform: Platform.OS };

export const authApi = {
  register: (data: { name: string; email: string; phone: string; password: string }) =>
    apiClient.post<AuthSession>('/auth/register', { ...data, ...deviceMeta }),
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthSession>('/auth/login', { ...data, ...deviceMeta }),
  logout: () => apiClient.post<{ success: boolean }>('/auth/logout'),
  logoutAll: () => apiClient.post<{ success: boolean }>('/auth/logout-all'),
  getCurrentUser: () => apiClient.get<AccountUser>('/users/me'),
  updateProfile: (data: { name?: string; email?: string; phone?: string }) =>
    apiClient.request<AccountUser>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getPreferences: () => apiClient.get<Record<string, unknown>>('/users/me/preferences'),
  updatePreferences: (data: Record<string, unknown>) =>
    apiClient.request<Record<string, unknown>>('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  getSubscription: () => apiClient.get<AccountSubscription>('/subscriptions/me'),
  getPlans: () => apiClient.get<Record<string, unknown>>('/subscriptions/plans'),
  forgotPassword: (email: string) => apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient.post<{ success: boolean }>('/auth/reset-password', { token, new_password: newPassword }),
};
