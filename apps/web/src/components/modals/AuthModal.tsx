import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModal, useAuth } from "../../contexts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
  Input,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

// Minimal ambient typing for the Google Identity Services script (loaded via a
// <script> tag, no npm package). Only the surface this modal actually uses.
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

declare global {
  const google: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (response: GoogleCredentialResponse) => void;
          auto_select?: boolean;
        }): void;
        renderButton(
          parent: HTMLElement,
          options: {
            theme?: string;
            size?: string;
            text?: string;
            locale?: string;
            width?: string;
          }
        ): void;
      };
    };
  };
}

// The OAuth client ID must match the one whose "Authorized JavaScript origins"
// list the site's origins AND the backend's GOOGLE_CLIENT_ID (the token's
// audience is checked server-side) — otherwise GSI reports "origin not allowed"
// and /api/auth/google rejects the token. Overridable per build via
// VITE_GOOGLE_CLIENT_ID; the fallback is the live "Client Web 1" credential.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ??
  "687983751036-9kgnu6hi5k8n3r9q0hf8ui8safd0pdr7.apps.googleusercontent.com";

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
    {children}
  </span>
);

export const AuthModal = () => {
  const { t, i18n } = useTranslation();
  const { closeModal } = useModal();
  const {
    login,
    register,
    googleLogin,
    submitGoogleUsername,
    authError,
    clearAuthError,
    needsGoogleUsername,
    user,
  } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [googleUsername, setGoogleUsername] = useState("");
  // The Google Identity script is injected `async defer` (see index.html), so on
  // first mount `google` is usually still undefined. Track when it becomes
  // available so the button effect can run as soon as the script loads instead
  // of only when the user happens to toggle the Login/Register tab.
  const [gsiReady, setGsiReady] = useState(() => typeof google !== "undefined");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const gsiInitialized = useRef(false);

  useEffect(() => {
    if (user) closeModal();
  }, [user, closeModal]);

  useEffect(() => {
    if (gsiReady) return;
    const interval = window.setInterval(() => {
      if (typeof google !== "undefined") {
        setGsiReady(true);
        window.clearInterval(interval);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [gsiReady]);

  const handleCredentialResponse = (response: GoogleCredentialResponse) => {
    googleLogin(response.credential, "");
  };

  // GSI captures the callback once at initialize() time, so route it through a
  // ref that always points at the latest handler. This keeps the closure
  // current (e.g. if `googleLogin` changes) without re-initializing GSI on
  // every render.
  const credentialHandlerRef = useRef(handleCredentialResponse);
  useEffect(() => {
    credentialHandlerRef.current = handleCredentialResponse;
  });

  // Initialize GSI exactly once. Calling initialize() again on every tab/locale
  // change (the old behaviour) logs "called multiple times" and orphans the
  // already-rendered button — "only the last initialized instance will be
  // used" — which is why the button only appeared after toggling the tab.
  useEffect(() => {
    if (!gsiReady || gsiInitialized.current) return;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => credentialHandlerRef.current(response),
      auto_select: false,
    });
    gsiInitialized.current = true;
  }, [gsiReady]);

  // (Re)render the button once GSI is ready and on tab/locale change. This runs
  // after the initialize effect above on the same commit, so it never renders
  // against an uninitialized instance.
  useEffect(() => {
    if (!gsiReady || !gsiInitialized.current || !googleButtonRef.current)
      return;
    const node = googleButtonRef.current;
    let cancelled = false;
    let timer = 0;
    let attempts = 0;

    // On the modal's first open — while it's still animating in and GSI is
    // freshly initialized — renderButton() often injects only an empty
    // placeholder that never fills on its own. That's why the button used to
    // appear only after the user toggled the Login/Register tab, which forces a
    // fresh render once GSI is ready. We reproduce that automatically with a
    // few GENTLE re-renders: the interval is much longer than GSI's own async
    // render (~0.5s) so we never clear one mid-flight, the empty-check runs
    // BEFORE re-rendering so a painted button is never wiped, and we stop as
    // soon as the real [role=button] appears.
    const render = () => {
      if (cancelled || !node.isConnected) return;
      node.innerHTML = "";
      google.accounts.id.renderButton(node, {
        theme: "outline",
        size: "large",
        text: isLogin ? "signin_with" : "signup_with",
        locale: i18n.language,
        // GSI wants a pixel width (max 400), not "100%", which it rejects with
        // "Provided button width is invalid" and then fails to render.
        width: "360",
      });
      attempts += 1;
      if (attempts < 6) {
        timer = window.setTimeout(() => {
          if (!cancelled && !node.querySelector('[role="button"]')) render();
        }, 1800);
      }
    };
    render();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [gsiReady, isLogin, i18n.language]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLogin) login(formData.email, formData.password);
    else register(formData.username, formData.email, formData.password);
  };

  const handleGoogleUsernameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (googleUsername.trim()) submitGoogleUsername(googleUsername.trim());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearAuthError();
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fieldError = (name: string) =>
    authError && authError.field === name ? authError.message : null;

  const fieldClass = (name: string) =>
    cn("mt-1", fieldError(name) && "border-red focus:ring-red/30");

  const close = (o: boolean) => {
    if (!o) closeModal();
  };

  if (needsGoogleUsername) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent
          widthClassName="w-[min(94vw,420px)]"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-xl font-bold mb-2">
            {t("auth.chooseUsername")}
          </DialogTitle>
          <p className="mb-4 text-ink-soft">{t("auth.welcomeChoose")}</p>
          <form onSubmit={handleGoogleUsernameSubmit}>
            <label className="block mb-4">
              <Label>{t("auth.username")}</Label>
              <Input
                className={fieldClass("username")}
                placeholder={t("auth.enterUsername")}
                value={googleUsername}
                onChange={(e) => {
                  clearAuthError();
                  setGoogleUsername(e.target.value);
                }}
                required
                autoFocus
              />
              {fieldError("username") && (
                <span className="text-red text-sm">
                  {fieldError("username")}
                </span>
              )}
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="ghost" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="green">
                {t("auth.createAccount")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent
        widthClassName="w-[min(94vw,440px)]"
        aria-describedby={undefined}
      >
        <Tabs
          value={isLogin ? "login" : "register"}
          onValueChange={(v) => {
            setIsLogin(v === "login");
            clearAuthError();
          }}
        >
          <DialogTitle className="sr-only">
            {isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}
          </DialogTitle>
          <TabsList className="mb-5 border-b-[3px] border-ink">
            <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>
            <TabsTrigger value="register">{t("auth.registerTab")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {authError?.field === "general" && (
          <div className="mb-4 rounded-lg border-2 border-red bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {authError.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <label className="block">
              <Label>{t("auth.username")}</Label>
              <Input
                name="username"
                className={fieldClass("username")}
                placeholder={t("auth.enterUsername")}
                value={formData.username}
                onChange={handleChange}
                required={!isLogin}
              />
              {fieldError("username") && (
                <span className="text-red text-sm">
                  {fieldError("username")}
                </span>
              )}
            </label>
          )}
          <label className="block">
            <Label>{t("auth.email")}</Label>
            <Input
              type="email"
              name="email"
              className={fieldClass("email")}
              placeholder={t("auth.enterEmail")}
              value={formData.email}
              onChange={handleChange}
              required
            />
            {fieldError("email") && (
              <span className="text-red text-sm">{fieldError("email")}</span>
            )}
          </label>
          <label className="block">
            <Label>{t("auth.password")}</Label>
            <Input
              type="password"
              name="password"
              className={fieldClass("password")}
              placeholder={t("auth.enterPassword")}
              value={formData.password}
              onChange={handleChange}
              required
            />
            {fieldError("password") && (
              <span className="text-red text-sm">{fieldError("password")}</span>
            )}
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="blue">
              {isLogin ? t("auth.loginButton") : t("auth.registerButton")}
            </Button>
          </div>
        </form>

        <div className="flex items-center gap-3 my-4 text-ink-soft text-sm font-semibold">
          <span className="flex-1 h-0.5 bg-ink/15" /> {t("auth.or")}
          <span className="flex-1 h-0.5 bg-ink/15" />
        </div>
        <div className="flex justify-center">
          <div ref={googleButtonRef} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
