/**
 * Turn an enum-ish wire string into a readable label without losing information.
 *
 * Lowercases, swaps `_` and `.` separators for spaces, collapses runs of
 * whitespace, and capitalises only the first letter. Null/empty-safe.
 *
 * @example humanizeLabel("LOGIN_FAILED_WRONG_PASSWORD") // "Login failed wrong password"
 * @example humanizeLabel("LEVEL.UPDATE_STATUS")         // "Level update status"
 * @example humanizeLabel("SIGN_UP_SUCCESS")             // "Sign up success"
 */
export function humanizeLabel(raw: string): string {
  if (!raw) return "";
  const text = raw
    .toLowerCase()
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
