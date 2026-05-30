import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../api";
import { notifyAuthChange } from "../../api/authEvents";
import { storage } from "../../lib/storage";
import type { LoginRequest, SignupRequest } from "@ouigame/shared/api";

export const useVerifySession = () => {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.verifySession,
    retry: false,
    enabled: storage.hasSession(),
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: LoginRequest) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      storage.setSessionId(data.sessionToken);
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
    mutationFn: ({ username, email, password }: SignupRequest) =>
      authApi.signup(username, email, password),
    onSuccess: (data) => {
      storage.setSessionId(data.sessionToken);
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
    mutationFn: ({
      idToken,
      username,
    }: {
      idToken: string;
      username?: string;
    }) => authApi.googleLogin(idToken, username),
    onSuccess: (data) => {
      storage.setSessionId(data.sessionToken);
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
      storage.clearSessionId();
      queryClient.setQueryData(["auth", "session"], null);
      // Only refresh user-scoped data; leave shared lists (rooms/levels) cached.
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["myLevels"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      notifyAuthChange();
    },
    onError: () => {
      // Even if logout fails on server, clear local session
      storage.clearSessionId();
      queryClient.setQueryData(["auth", "session"], null);
      notifyAuthChange();
    },
  });
};
