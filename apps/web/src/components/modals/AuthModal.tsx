import { useState, useEffect, useRef } from "react";
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

const GOOGLE_CLIENT_ID =
  "403445313450-kvueoci8r29rcpqk2p8jle1escfn6cc9.apps.googleusercontent.com";

export const AuthModal = () => {
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
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) closeModal();
  }, [user, closeModal]);

  useEffect(() => {
    if (typeof google !== "undefined" && googleButtonRef.current) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: isLogin ? "signin_with" : "signup_with",
        locale: "en",
        width: "100%",
      });
    }
  }, [isLogin]);

  const handleCredentialResponse = (response: GoogleCredentialResponse) => {
    googleLogin(response.credential, "");
  };

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

  const Label = ({ children }: { children: React.ReactNode }) => (
    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </span>
  );

  const close = (o: boolean) => {
    if (!o) closeModal();
  };

  if (needsGoogleUsername) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent widthClassName="w-[min(94vw,420px)]">
          <DialogTitle className="text-xl font-bold mb-2">
            Choose a Username
          </DialogTitle>
          <p className="mb-4 text-ink-soft">
            Welcome! Please choose a username for your new account.
          </p>
          <form onSubmit={handleGoogleUsernameSubmit}>
            <label className="block mb-4">
              <Label>Username</Label>
              <Input
                className={fieldClass("username")}
                placeholder="Enter username"
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
                Cancel
              </Button>
              <Button type="submit" variant="green">
                Create Account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent widthClassName="w-[min(94vw,440px)]">
        <Tabs
          value={isLogin ? "login" : "register"}
          onValueChange={(v) => {
            setIsLogin(v === "login");
            clearAuthError();
          }}
        >
          <DialogTitle className="sr-only">
            {isLogin ? "Log in" : "Register"}
          </DialogTitle>
          <TabsList className="mb-5 border-b-[3px] border-ink">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <label className="block">
              <Label>Username</Label>
              <Input
                name="username"
                className={fieldClass("username")}
                placeholder="Enter username"
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
            <Label>Email</Label>
            <Input
              type="email"
              name="email"
              className={fieldClass("email")}
              placeholder="Enter email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            {fieldError("email") && (
              <span className="text-red text-sm">{fieldError("email")}</span>
            )}
          </label>
          <label className="block">
            <Label>Password</Label>
            <Input
              type="password"
              name="password"
              className={fieldClass("password")}
              placeholder="Enter password"
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
              Cancel
            </Button>
            <Button type="submit" variant="blue">
              {isLogin ? "Login" : "Register"}
            </Button>
          </div>
        </form>

        <div className="flex items-center gap-3 my-4 text-ink-soft text-sm font-semibold">
          <span className="flex-1 h-0.5 bg-ink/15" /> OR
          <span className="flex-1 h-0.5 bg-ink/15" />
        </div>
        <div className="flex justify-center">
          <div ref={googleButtonRef} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
