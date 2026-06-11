import type { ApiRequestError } from "../api/client";

// The API reports failures as `{ error: <code>, message: <englishText> }` (see
// apps/api). The English `message` is for developers/logs — it must never reach
// the user. Instead we read the stable `error` CODE and map it to an i18n key,
// so every failure renders a localized message in the player's language.

/** The structured error code from an API error body, if the server sent one. */
export function serverErrorCode(error: unknown): string | undefined {
  const data = (error as ApiRequestError | undefined)?.data;
  if (data && typeof data === "object" && "error" in data) {
    const code = (data as { error?: unknown }).error;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}
