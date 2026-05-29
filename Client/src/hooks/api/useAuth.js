import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../api";
import { notifyAuthChange } from "../../api/authEvents";

export const useVerifySession = () => {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.verifySession,
    retry: false,
    enabled: !!localStorage.getItem("session_id"),
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }) => authApi.login(email, password),
    onSuccess: (data) => {
      localStorage.setItem("session_id", data.sessionToken);
      queryClient.setQueryData(["auth", "session"], {
        username: data.username,
        email: data.email,
      });
      notifyAuthChange();
    },
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, email, password }) =>
      authApi.signup(username, email, password),
    onSuccess: (data) => {
      localStorage.setItem("session_id", data.sessionToken);
      queryClient.setQueryData(["auth", "session"], {
        username: data.username,
        email: data.email,
      });
      notifyAuthChange();
    },
  });
};

export const useGoogleLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idToken, username }) =>
      authApi.googleLogin(idToken, username),
    onSuccess: (data) => {
      localStorage.setItem("session_id", data.sessionToken);
      queryClient.setQueryData(["auth", "session"], {
        username: data.username,
        email: data.email,
      });
      notifyAuthChange();
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      localStorage.removeItem("session_id");
      queryClient.setQueryData(["auth", "session"], null);
      // Only refresh user-scoped data; leave shared lists (rooms/levels) cached.
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["myLevels"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      notifyAuthChange();
    },
    onError: () => {
      // Even if logout fails on server, clear local session
      localStorage.removeItem("session_id");
      queryClient.setQueryData(["auth", "session"], null);
      notifyAuthChange();
    },
  });
};
