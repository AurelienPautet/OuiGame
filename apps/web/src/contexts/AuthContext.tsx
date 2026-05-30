import { createContext, useContext, useState, type ReactNode } from "react";
import type { VerifySessionResponse } from "@ouigame/shared/api";
import {
  useVerifySession,
  useLogin,
  useSignup,
  useGoogleLogin,
  useLogout,
} from "../hooks/api";

// The authenticated user, as returned by the verify-session query.
type AuthUser = VerifySessionResponse;

// A single field-scoped error surfaced from a login/signup/google mutation.
interface AuthFieldError {
  field: "email" | "password" | "username" | "general";
  message: string;
}

// The error shape carried by the api client's thrown errors: a standard Error
// plus an optional structured `data` envelope ({ error, message }).
interface MutationError extends Error {
  data?: { error?: string; message?: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  authError: AuthFieldError | null;
  needsGoogleUsername: boolean;
  login: (email: string, password: string) => void;
  register: (username: string, email: string, password: string) => void;
  googleLogin: (idToken: string, username?: string) => void;
  submitGoogleUsername: (username: string) => void;
  clearAuthError: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [needsGoogleUsername, setNeedsGoogleUsername] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(
    null
  );

  const { data: sessionData, isLoading } = useVerifySession();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const googleLoginMutation = useGoogleLogin();
  const logoutMutation = useLogout();

  const user: AuthUser | null = sessionData || null;

  const login = (email: string, password: string) => {
    loginMutation.mutate({ email, password });
  };

  const register = (username: string, email: string, password: string) => {
    signupMutation.mutate({ username, email, password });
  };

  const googleLogin = (idToken: string, username = "") => {
    setPendingGoogleToken(idToken);
    googleLoginMutation.mutate(
      { idToken, username },
      {
        onError: (error: MutationError) => {
          if (
            error.data?.error === "username_required" ||
            error.message?.includes("Username required")
          ) {
            setNeedsGoogleUsername(true);
          }
        },
        onSuccess: () => {
          setNeedsGoogleUsername(false);
          setPendingGoogleToken(null);
        },
      }
    );
  };

  const submitGoogleUsername = (username: string) => {
    if (pendingGoogleToken) {
      googleLogin(pendingGoogleToken, username);
    }
  };

  const logout = () => {
    logoutMutation.mutate();
    setNeedsGoogleUsername(false);
    setPendingGoogleToken(null);
  };

  const getMutationError = (): AuthFieldError | null => {
    if (loginMutation.error) {
      const err = loginMutation.error as MutationError;
      if (err.data?.error === "email") {
        return {
          field: "email",
          message: err.data?.message || "Email not found",
        };
      }
      if (err.data?.error === "password") {
        return {
          field: "password",
          message: err.data?.message || "Invalid password",
        };
      }
      return { field: "general", message: err.message };
    }
    if (signupMutation.error) {
      const err = signupMutation.error as MutationError;
      if (err.data?.error === "username") {
        return {
          field: "username",
          message: err.data?.message || "Username already taken",
        };
      }
      if (err.data?.error === "email") {
        return {
          field: "email",
          message: err.data?.message || "Email already registered",
        };
      }
      return { field: "general", message: err.message };
    }
    if (googleLoginMutation.error && !needsGoogleUsername) {
      const err = googleLoginMutation.error as MutationError;
      if (err.data?.error === "username") {
        return {
          field: "username",
          message: err.data?.message || "Username already taken",
        };
      }
      return { field: "general", message: err.message };
    }
    return null;
  };

  const authError = getMutationError();

  const clearAuthError = () => {
    loginMutation.reset();
    signupMutation.reset();
    googleLoginMutation.reset();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading:
          isLoading ||
          loginMutation.isPending ||
          signupMutation.isPending ||
          googleLoginMutation.isPending,
        authError,
        needsGoogleUsername,
        login,
        register,
        googleLogin,
        submitGoogleUsername,
        clearAuthError,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
