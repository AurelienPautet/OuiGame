import { createContext, useContext, useState } from "react";
import {
  useVerifySession,
  useLogin,
  useSignup,
  useGoogleLogin,
  useLogout,
} from "../hooks/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [needsGoogleUsername, setNeedsGoogleUsername] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState(null);

  const { data: sessionData, isLoading } = useVerifySession();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const googleLoginMutation = useGoogleLogin();
  const logoutMutation = useLogout();

  const user = sessionData || null;

  const login = (email, password) => {
    loginMutation.mutate({ email, password });
  };

  const register = (username, email, password) => {
    signupMutation.mutate({ username, email, password });
  };

  const googleLogin = (idToken, username = "") => {
    setPendingGoogleToken(idToken);
    googleLoginMutation.mutate(
      { idToken, username },
      {
        onError: (error) => {
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
      },
    );
  };

  const submitGoogleUsername = (username) => {
    if (pendingGoogleToken) {
      googleLogin(pendingGoogleToken, username);
    }
  };

  const logout = () => {
    logoutMutation.mutate();
    setNeedsGoogleUsername(false);
    setPendingGoogleToken(null);
  };

  const getMutationError = () => {
    if (loginMutation.error) {
      const err = loginMutation.error;
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
      const err = signupMutation.error;
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
      const err = googleLoginMutation.error;
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
