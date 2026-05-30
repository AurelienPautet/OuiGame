import { storage } from "../lib/storage";

// VITE_API_URL (build-time, e.g. the itch.io build) wins; otherwise the
// hosted prod API / local dev default — so the normal build is unchanged.
const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? "https://wiitank.pautet.net/api"
    : "http://localhost:8000/api");

// The thrown error carries the HTTP status and the parsed error body. (Named
// distinctly from @ouigame/shared/api's `ApiError`, which is the error-response
// *body* shape, to avoid a confusing collision.)
export interface ApiRequestError extends Error {
  status?: number;
  data?: unknown;
}

class ApiClient {
  baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  getAuthHeaders(): Record<string, string> {
    const token = storage.getSessionId();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Generic over the response type. Defaults to `unknown` (not `any`) so the
  // existing untyped callers stay safe; typed callers opt in via request<T>().
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || data.error || "Request failed"
      ) as ApiRequestError;
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data as T;
  }

  get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient(BASE_URL);
