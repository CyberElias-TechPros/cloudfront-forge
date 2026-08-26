import axios from "axios";

// In dev the Vite server proxies same-origin /api/* requests to the worker (see
// vite.config.ts), so no CORS and no hard-coded localhost URL is needed. In
// production VITE_API_URL must point at the deployed worker; the localhost
// fallback below only exists to preserve the previous behaviour.
const apiUrl =
  import.meta.env["VITE_API_URL"] || (import.meta.env.DEV ? "" : "http://localhost:8787");

const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.debug("[API] No authentication token available");
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error?.message || error.message || "An unexpected error occurred";

    if (status === 401) {
      console.warn("[API] Authentication required - user may not be logged in or token is invalid");
    } else if (status === 403) {
      console.warn("[API] Permission denied");
    } else if (status >= 500) {
      console.error("[API] Server error:", status, message);
    }

    return Promise.reject(new Error(message));
  },
);

import { getIdToken } from "./firebase";

const getToken = async (): Promise<string | null> => {
  return await getIdToken();
};

export function apiResponse<T>(response: { data: { success: boolean; data?: T } }): T {
  if (!response.data.success || !response.data.data) {
    throw new Error("Invalid API response structure");
  }
  return response.data.data;
}

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await apiClient.get(url);
    return apiResponse<T>(response);
  },
  post: async <T, D = Record<string, unknown>>(url: string, data?: D): Promise<T> => {
    const response = await apiClient.post(url, data);
    return apiResponse<T>(response);
  },
  put: async <T, D = Record<string, unknown>>(url: string, data?: D): Promise<T> => {
    const response = await apiClient.put(url, data);
    return apiResponse<T>(response);
  },
  delete: async <T>(url: string): Promise<T> => {
    const response = await apiClient.delete(url);
    return apiResponse<T>(response);
  },
};

export default apiClient;
