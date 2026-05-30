import { z } from "zod";

// Response shared by POST /auth/signup, /auth/login and /auth/google.
// `sessionToken` is camelCase on the wire (do NOT rename to session_id — that is
// the localStorage key, a separate concern).
export const AuthResponseSchema = z.object({
  username: z.string(),
  email: z.string(),
  sessionToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const VerifySessionResponseSchema = z.object({
  username: z.string(),
  email: z.string(),
});
export type VerifySessionResponse = z.infer<typeof VerifySessionResponseSchema>;

// Request bodies (camelCase wire). `idToken` is camelCase and load-bearing.
export const SignupRequestSchema = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const GoogleLoginRequestSchema = z.object({
  idToken: z.string(),
  username: z.string().optional(),
});
export type GoogleLoginRequest = z.infer<typeof GoogleLoginRequestSchema>;

// Error envelopes. The auth routes use { error, message }; every other route
// uses { error } only — so the general envelope keeps `message` optional.
export const AuthErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type AuthError = z.infer<typeof AuthErrorSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
