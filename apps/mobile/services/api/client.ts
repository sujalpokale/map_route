import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getDevHostIp = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  const devMachineIp = hostUri ? hostUri.split(':')[0] : null;

  if (process.env.EXPO_PUBLIC_API_URL) {
    const rawUrl = process.env.EXPO_PUBLIC_API_URL;
    if (Platform.OS !== 'web' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      if (devMachineIp && devMachineIp !== 'localhost' && devMachineIp !== '127.0.0.1') {
        return rawUrl.replace(/localhost|127\.0\.0\.1/, devMachineIp);
      }
      if (Platform.OS === 'android') {
        return rawUrl.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
      }
    }
    return rawUrl;
  }

  if (devMachineIp && devMachineIp !== 'localhost' && devMachineIp !== '127.0.0.1') {
    return `http://${devMachineIp}:8000/api/v1`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1';
};

export const API_BASE_URL = getDevHostIp();

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private token: string | null = null;

  setAuthToken(token: string | null) {
    this.token = token;
  }

  getAuthToken(): string | null {
    return this.token;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let timeoutId: any = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, 10000); // 10s timeout

      // If consumer passed their own AbortSignal, listen to it
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener('abort', () => {
            try {
              controller.abort();
            } catch {}
          });
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const status = response.status;
      if (!response.ok) {
        let errorDetail = `Request failed with status ${status}`;
        try {
          const errJson = await response.json();
          errorDetail = errJson.detail || errJson.message || errorDetail;
        } catch {
          // fallback string
        }
        return { data: null, error: errorDetail, status };
      }

      const data = await response.json();
      return { data, error: null, status };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      const isCanceledOrTimeout =
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase().includes('cancel') ||
        err?.message?.toLowerCase().includes('abort');
      const message = isCanceledOrTimeout
        ? 'Request timed out or was canceled.'
        : err?.message || 'Unable to connect to Route Intelligence server.';
      
      return { data: null, error: message, status: 0 };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const query = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (query) {
        url += (url.includes('?') ? '&' : '?') + query;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
