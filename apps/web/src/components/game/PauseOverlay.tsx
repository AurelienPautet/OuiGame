import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Play, LogOut, Pause, Settings, RotateCcw } from "lucide-react";
import { Button } from "../ui/primitives";
import { OverlayScrim, OverlayPanel } from "./overlay";
import { useSettings } from "../../contexts";
import { useTouchControlsEnabled } from "../../lib/touch";
import { keyLabel } from "../../lib/settings";

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
  onSettings: () => void;
  // Solo/campaign only; GameCanvas passes `undefined` for online, so this must
  // explicitly admit undefined under exactOptionalPropertyTypes.
  onRetry?: (() => void) | undefined;
}

/** A single key / input cap, matching the flat arcade key style. */
const Cap = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 text-xs leading-none font-display font-bold text-ink-soft bg-white border-2 border-ink/15 rounded-md">
    {children}
  </kbd>
);

/** One "what does what" row in the controls explainer. */
const ControlRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm font-semibold text-ink">{label}</span>
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

/**
 * Pause overlay — same white arcade card as the end screens, so pausing reads
 * as part of the same overlay system rather than a one-off. It also doubles as
 * a quick controls reference: the rows mirror the player's *current* bindings
 * (so a rebind shows here too) and swap to the on-screen stick/buttons labels
 * when touch controls are active.
 */
export const PauseOverlay = ({
  onResume,
  onQuit,
  onSettings,
  onRetry,
}: PauseOverlayProps) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const touch = useTouchControlsEnabled();
  const { keybindings } = settings;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === "r" || e.key === "R") && onRetry) onRetry();
      if (e.key === "e" || e.key === "E") onQuit();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onRetry, onQuit]);

  const c = (k: string) => t(`pause.controls.${k}`);

  return (
    <OverlayScrim>
      <OverlayPanel
        icon={<Pause className="w-14 h-14 text-ink" />}
        title={t("pause.title")}
      >
        <div className="flex flex-col gap-4 w-full">
          {/* Controls reference */}
          <div className="w-full">
            <h3 className="font-display font-bold text-xs uppercase tracking-wide text-ink-soft mb-2 text-left">
              {c("title")}
            </h3>
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 bg-[#f1f3f6] p-3">
              {touch ? (
                <>
                  <ControlRow label={c("move")}>
                    <Cap>{c("moveStick")}</Cap>
                  </ControlRow>
                  <ControlRow label={c("aim")}>
                    <Cap>{c("aimStick")}</Cap>
                  </ControlRow>
                  <ControlRow label={c("fire")}>
                    <Cap>
                      {settings.autoFire ? c("holdAim") : c("fireButton")}
                    </Cap>
                  </ControlRow>
                  <ControlRow label={c("plant")}>
                    <Cap>{c("mineButton")}</Cap>
                  </ControlRow>
                </>
              ) : (
                <>
                  <ControlRow label={c("move")}>
                    <Cap>{keyLabel(keybindings.up)}</Cap>
                    <Cap>{keyLabel(keybindings.left)}</Cap>
                    <Cap>{keyLabel(keybindings.down)}</Cap>
                    <Cap>{keyLabel(keybindings.right)}</Cap>
                  </ControlRow>
                  <ControlRow label={c("aim")}>
                    <Cap>{c("mouse")}</Cap>
                  </ControlRow>
                  <ControlRow label={c("fire")}>
                    <Cap>{c("click")}</Cap>
                  </ControlRow>
                  <ControlRow label={c("plant")}>
                    <Cap>{keyLabel(keybindings.plant)}</Cap>
                  </ControlRow>
                  <ControlRow label={c("pause")}>
                    <Cap>{c("esc")}</Cap>
                  </ControlRow>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            <Button variant="green" className="w-full" onClick={onResume}>
              <Play className="w-4 h-4" />
              {t("pause.resume")}
            </Button>
            {onRetry && (
              <Button variant="blue" className="w-full" onClick={onRetry}>
                <RotateCcw className="w-4 h-4" />
                {t("pause.retry")}
                <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-white/20 border border-white/30 rounded">
                  R
                </kbd>
              </Button>
            )}
            <div className="flex gap-3 w-full">
              <Button variant="ghost" className="flex-1" onClick={onSettings}>
                <Settings className="w-4 h-4" />
                {t("pause.settings")}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={onQuit}>
                <LogOut className="w-4 h-4" />
                {t("pause.quit")}
                <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-black/10 border border-black/15 rounded">
                  E
                </kbd>
              </Button>
            </div>
          </div>
        </div>
      </OverlayPanel>
    </OverlayScrim>
  );
};
