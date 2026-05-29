import { apiClient } from "../client";

export const authApi = {
  signup: (username, email, password) =>
    apiClient.post("/auth/signup", { username, email, password }),

  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }),

  googleLogin: (idToken, username) =>
    apiClient.post("/auth/google", { idToken, username }),

  logout: () => apiClient.post("/auth/logout"),

  verifySession: () => apiClient.get("/auth/verify-session"),
};
