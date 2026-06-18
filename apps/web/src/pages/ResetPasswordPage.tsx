import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useResetPassword } from "../hooks/api";
import { useModal } from "../contexts";
import { Button, Input } from "../components/ui/primitives";
import { cn } from "../lib/cn";

// The error shape carried by the api client's thrown errors: a standard Error
// plus an optional structured `data` envelope ({ error, message }).
interface MutationError extends Error {
  data?: { error?: string; message?: string };
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
    {children}
  </span>
);

// Landing page for the password-reset link emailed to the user
// (#/reset-password?token=...). Reads the one-time token from the query string,
// collects + confirms a new password, and submits it. On success the server has
// already invalidated every session, so we just point the user back to login.
export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openModal, MODALS } = useModal();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const resetPassword = useResetPassword();

  const goToLogin = () => {
    navigate("/");
    openModal(MODALS.AUTH);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    // Mirror the server's rules client-side for instant feedback (the server
    // still re-validates).
    if (password.length < 8) {
      setLocalError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setLocalError(t("auth.passwordsDontMatch"));
      return;
    }
    resetPassword.mutate({ token, password });
  };

  const serverError = resetPassword.error as MutationError | null;
  const errorMessage =
    localError ??
    (serverError
      ? serverError.data?.error === "token"
        ? t("auth.resetInvalidToken")
        : (serverError.data?.message ?? serverError.message)
      : null);

  return (
    <div className="flex justify-center pt-10">
      <div className="w-[min(94vw,440px)] bg-white border-4 border-ink rounded-2xl shadow-btn p-6">
        {!token ? (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t("auth.resetPasswordTitle")}
            </h1>
            <p className="mb-6 text-ink-soft">{t("auth.resetInvalidToken")}</p>
            <div className="flex justify-end">
              <Button variant="blue" onClick={goToLogin}>
                {t("auth.backToLogin")}
              </Button>
            </div>
          </>
        ) : resetPassword.isSuccess ? (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t("auth.resetSuccessTitle")}
            </h1>
            <p className="mb-6 text-ink-soft">{t("auth.resetSuccessDesc")}</p>
            <div className="flex justify-end">
              <Button variant="green" onClick={goToLogin}>
                {t("auth.goToLogin")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t("auth.resetPasswordTitle")}
            </h1>
            <p className="mb-4 text-ink-soft">
              {t("auth.resetPasswordPrompt")}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <Label>{t("auth.newPassword")}</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder={t("auth.enterNewPassword")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="block">
                <Label>{t("auth.confirmPassword")}</Label>
                <Input
                  type="password"
                  className={cn(
                    "mt-1",
                    errorMessage && "border-red focus:ring-red/30"
                  )}
                  placeholder={t("auth.enterConfirmPassword")}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </label>
              {errorMessage && (
                <div className="rounded-lg border-2 border-red bg-red/10 px-3 py-2 text-sm font-semibold text-red">
                  {errorMessage}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={goToLogin}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="blue"
                  disabled={resetPassword.isPending}
                >
                  {t("auth.resetPasswordButton")}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
