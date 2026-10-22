import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getIdToken } from "./firebase";
import { retryDelayMs, shouldRetry, sleep } from "./retry";

// In dev the Vite server proxies same-origin /api requests to the worker (see
// vite.config.ts), so no CORS and no hard-coded localhost URL is needed. In
// production VITE_API_URL must point at the deployed worker: silently falling
// back to http://localhost:8787 made every production request fail against the
// visitor's own machine.
const configuredApiUrl = import.meta.env["VITE_API_URL"] as string | undefined;
if (!configuredApiUrl && !import.meta.env.DEV) {
  console.error(
    "[API] VITE_API_URL is not set. Point it at the deployed Cloudflare Worker (e.g. https://loop-api.<subdomain>.workers.dev).",
  );
}
const apiUrl = configuredApiUrl ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    /**
     * Correlation id from `X-Request-Id`. Support can find the exact request in
     * the Worker logs with it; without it a bug report is unactionable.
     */
    readonly requestId?: string,
    /** Server-advised wait from `Retry-After`, when the server sent one. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RetryableRequest = InternalAxiosRequestConfig & {
  _authRetried?: boolean;
  _attempt?: number;
};

const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const message =
      error.response?.data?.error?.message || error.message || "An unexpected error occurred";
    const config = error.config as RetryableRequest | undefined;
    const requestId = error.response?.headers?.["x-request-id"] as string | undefined;
    const retryAfterHeader = error.response?.headers?.["retry-after"] as string | undefined;

    // Transient failure on a read: wait as long as the server asked (or back off
    // with jitter when it did not) and try again. Writes are excluded on purpose
    // — only endpoints with an `Idempotency-Key` may be replayed, and those are
    // retried by the caller that owns the key.
    if (config) {
      const attempt = config._attempt ?? 0;
      if (shouldRetry({ status, method: config.method, attempt, retryAfterHeader })) {
        config._attempt = attempt + 1;
        await sleep(retryDelayMs(attempt, retryAfterHeader));
        return apiClient.request(config);
      }
    }

    // Firebase refreshes ID tokens automatically, but a token can expire between
    // request construction and verification. Refresh and replay exactly once;
    // React Query must not multiply an authentication race into a request storm.
    if (status === 401 && config && !config._authRetried) {
      config._authRetried = true;
      const freshToken = await getIdToken(true);
      if (freshToken) {
        config.headers.set("Authorization", `Bearer ${freshToken}`);
        return apiClient.request(config);
      }
    }

    if (status === 401) {
      console.warn("[API] Authentication required - sign in again if this persists");
    } else if (status === 403) {
      console.warn("[API] Permission denied");
    } else if (status !== undefined && status >= 500) {
      console.error("[API] Server error:", status, code ?? "UNKNOWN", message);
    }

    return Promise.reject(
      new ApiError(
        message,
        status,
        code,
        requestId,
        retryAfterHeader ? Number(retryAfterHeader) || undefined : undefined,
      ),
    );
  },
);

export function apiResponse<T>(response: { data: { success: boolean; data?: T } }): T {
  if (!response.data.success || response.data.data === undefined) {
    throw new ApiError("Invalid API response structure");
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
