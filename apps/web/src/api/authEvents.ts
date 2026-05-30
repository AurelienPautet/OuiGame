// Minimal event bus so non-React modules (e.g. the socket layer) can react to
// login/logout without depending on React context. useAuth fires
// notifyAuthChange() after it updates the stored session token.
const target = new EventTarget();
const AUTH_CHANGED = "auth-changed";

export function notifyAuthChange(): void {
  target.dispatchEvent(new Event(AUTH_CHANGED));
}

export function onAuthChange(handler: () => void): () => void {
  target.addEventListener(AUTH_CHANGED, handler);
  return () => target.removeEventListener(AUTH_CHANGED, handler);
}
