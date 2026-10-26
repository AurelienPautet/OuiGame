import { useState, useEffect } from "react";
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

let activeCredentialHandler:
  | ((response: GoogleCredentialResponse) => void)
  | null = null;
let gsiInitialized = false;

function ensureGsiInitialized() {
  if (gsiInitialized || typeof google === "undefined") return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      activeCredentialHandler?.(response);
    },
    auto_select: false,
  });
  gsiInitialized = true;
}

function resetGsiStateForTesting() {
  gsiInitialized = false;
  activeCredentialHandler = null;
}

function AuthModalComponent() {
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
  // available so the button effect can run as soon as the script loads.
  const [gsiReady, setGsiReady] = useState(() => typeof google !== "undefined");

  // Radix's DialogContent renders inside a Portal (<RadixDialog.Portal>).
  // On initial mount, Radix Portal delays rendering its children until its layout
  // effect has mounted. Because AuthModal's initial commit runs before Radix's
  // Portal mounts children into the DOM, a standard useRef (googleButtonRef.current)
  // is still null during AuthModal's initial useEffect commit. Since useRef
  // mutations do not trigger a re-render, the button render effect never ran on
  // initial open — it only ran when the user changed state by toggling tabs.
  // Using a callback ref with useState (setGoogleButtonContainer) ensures that as
  // soon as Radix's Portal mounts the DOM element, AuthModal re-renders with the
  // attached node, immediately triggering the button render on first modal open.
  const [googleButtonContainer, setGoogleButtonContainer] =
    useState<HTMLDivElement | null>(null);

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

  // Route GSI callbacks to the current modal instance's handler without
  // re-initializing GSI on every render.
  useEffect(() => {
    activeCredentialHandler = handleCredentialResponse;
    return () => {
      if (activeCredentialHandler === handleCredentialResponse) {
        activeCredentialHandler = null;
      }
    };
  });

  // (Re)render the button once GSI is ready and the container node is mounted,
  // as well as on tab (isLogin) or locale (i18n.language) changes.
  useEffect(() => {
    if (!gsiReady || !googleButtonContainer) return;
    ensureGsiInitialized();
    const node = googleButtonContainer;
    let cancelled = false;
    let timer = 0;
    let attempts = 0;

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
          if (!cancelled && !node.querySelector('[role="button"], iframe')) {
            render();
          }
        }, 1800);
      }
    };
    render();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [gsiReady, isLogin, i18n.language, googleButtonContainer]);

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
    authError && authError.field === name ? t(authError.messageKey) : null;

  const fieldClass = (name: string) =>
    cn("mt-1", fieldError(name) && "border-red focus:ring-red/30");

  // Errors not tied to a specific input (network failure, validation, Google
  // sign-in problems) surface in a banner above the form instead of silently
  // vanishing.
  const generalError =
    authError && authError.field === "general" ? t(authError.messageKey) : null;

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

        {generalError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border-2 border-red bg-red/10 px-3 py-2 text-sm font-semibold text-red"
          >
            {generalError}
          </p>
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
        <div className="flex justify-center min-h-[44px]">
          <div ref={setGoogleButtonContainer} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const AuthModal = Object.assign(AuthModalComponent, {
  _resetGsiStateForTesting: resetGsiStateForTesting,
});
