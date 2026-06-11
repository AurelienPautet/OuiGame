import { createContext, useContext, useState, type ReactNode } from "react";
import type { VerifySessionResponse } from "@ouigame/shared/api";
import {
  useVerifySession,
  useLogin,
  useSignup,
  useGoogleLogin,
  useLogout,
} from "../hooks/api";
import { serverErrorCode } from "../lib/serverError";

// The authenticated user, as returned by the verify-session query.
type AuthUser = VerifySessionResponse;

// A single field-scoped error surfaced from a login/signup/google mutation. The
// message is carried as an i18n KEY (under `auth.errors.*`) rather than resolved
// text, so AuthModal renders it with t() — localized and reactive to language
// changes. We never forward the server's raw English `message`.
interface AuthFieldError {
  field: "email" | "password" | "username" | "general";
  messageKey: string;
}

// The error shape carried by the api client's thrown errors: a standard Error
// plus an optional structured `data` envelope ({ error, message }).
interface MutationError extends Error {
  data?: { error?: string; message?: string };
}

// Map each server error CODE to a field + localizable message key, per flow.
// Unknown or absent codes fall back to GENERIC_ERROR.
const GENERIC_ERROR: AuthFieldError = {
  field: "general",
  messageKey: "auth.errors.generic",
};

const LOGIN_ERRORS: Record<string, AuthFieldError> = {
  email: { field: "email", messageKey: "auth.errors.emailNotFound" },
  password: { field: "password", messageKey: "auth.errors.invalidPassword" },
  validation: { field: "general", messageKey: "auth.errors.validation" },
};

const SIGNUP_ERRORS: Record<string, AuthFieldError> = {
  username: { field: "username", messageKey: "auth.errors.usernameTaken" },
  email: { field: "email", messageKey: "auth.errors.emailRegistered" },
  validation: { field: "general", messageKey: "auth.errors.validation" },
};

const GOOGLE_ERRORS: Record<string, AuthFieldError> = {
  username: { field: "username", messageKey: "auth.errors.usernameTaken" },
  email_required: { field: "general", messageKey: "auth.errors.googleNoEmail" },
};

const mapAuthError = (
  error: unknown,
  table: Record<string, AuthFieldError>
): AuthFieldError => {
  const code = serverErrorCode(error);
  // hasOwn guards against a server code like "constructor"/"__proto__" reaching
  // through to a prototype member instead of a real table entry.
  return (code && Object.hasOwn(table, code) && table[code]) || GENERIC_ERROR;
};

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
      return mapAuthError(loginMutation.error, LOGIN_ERRORS);
    }
    if (signupMutation.error) {
      return mapAuthError(signupMutation.error, SIGNUP_ERRORS);
    }
    if (googleLoginMutation.error && !needsGoogleUsername) {
      return mapAuthError(googleLoginMutation.error, GOOGLE_ERRORS);
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
