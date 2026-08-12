import axios from "axios";

const apiUrl = import.meta.env["VITE_API_URL"] || "http://localhost:8787";

const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

import { getIdToken } from "./firebase";

const getToken = async (): Promise<string | null> => {
  return await getIdToken();
};

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await apiClient.get(url);
    return response.data.data as T;
  },
  post: async <T, D = Record<string, unknown>>(url: string, data?: D): Promise<T> => {
    const response = await apiClient.post(url, data);
    return response.data.data as T;
  },
  put: async <T, D = Record<string, unknown>>(url: string, data?: D): Promise<T> => {
    const response = await apiClient.put(url, data);
    return response.data.data as T;
  },
  delete: async <T>(url: string): Promise<T> => {
    const response = await apiClient.delete(url);
    return response.data.data as T;
  },
};

export default apiClient;
