// Test-only helper (not a suite — no .test/.spec suffix). Builds a fresh
// QueryClient per call (retry off; gcTime Infinity so setQueryData entries with
// no active observer aren't garbage-collected mid-assertion) and returns both
// the wrapper and the client, so tests can read getQueryData and spy on
// invalidateQueries on the exact client the hook under test uses. The client is
// discarded after each test, so disabling GC doesn't leak across tests.
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
