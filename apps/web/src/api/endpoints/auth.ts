import { apiClient } from "../client";
import type { AuthResponse, VerifySessionResponse } from "@ouigame/shared/api";

// Phase 1b adoption demo #1: typing the auth response end-to-end. useAuth.js
// already reads exactly data.sessionToken / data.username / data.email, so the
// shared DTO flows through with zero runtime change. (Type-only import — the Zod
// schemas are not pulled into the bundle.)
export const authApi = {
  signup: (username: string, email: string, password: string) =>
    apiClient.post<AuthResponse>("/auth/signup", { username, email, password }),

  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>("/auth/login", { email, password }),

  googleLogin: (idToken: string, username?: string) =>
    apiClient.post<AuthResponse>("/auth/google", { idToken, username }),

  logout: () => apiClient.post("/auth/logout"),

  verifySession: () =>
    apiClient.get<VerifySessionResponse>("/auth/verify-session"),
};
