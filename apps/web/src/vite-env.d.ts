/// <reference types="vite/client" />

// Build-time env for pointing the client at a backend. Unset in the normal
// build (falls back to the PROD/dev defaults); set by the itch.io build
// (.env.itch) so the static bundle talks to the hosted API/socket cross-origin.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
