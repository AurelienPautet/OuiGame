// Test-only helper (no .test/.spec suffix, so it's not collected as a suite).
// Renders a component tree inside the providers most UI components expect: a
// fresh TanStack Query client (retries off), the real i18n instance (so
// useTranslation() returns actual English copy rather than raw keys), and a
// ModalProvider for components that call useModal(). Returns Testing Library's
// result plus the QueryClient, so a test can assert on cache/queries if needed.
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ModalProvider } from "../contexts";

export function renderWithProviders(ui: ReactElement) {
  // English keeps text assertions deterministic regardless of the jsdom locale.
  void i18n.changeLanguage("en");

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ModalProvider>{children}</ModalProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );

  return { client, ...render(ui, { wrapper: Wrapper }) };
}
