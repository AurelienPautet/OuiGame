import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { useTouchControlsEnabled, useIsPortrait } from "../../lib/touch";

/**
 * Full-window prompt shown on touch devices held in portrait. The arena is
 * landscape (1150×800), so portrait fits it to a tiny strip; we ask the player
 * to rotate. It does not stop the game — once rotated the arena letterboxes
 * normally. Rendered inside FixedUiLayer so it stays at true window size, and
 * gated by useTouchControlsEnabled so it never shows on desktop/mouse.
 */
export const OrientationHint = () => {
  const { t } = useTranslation();
  const touchEnabled = useTouchControlsEnabled();
  const portrait = useIsPortrait();

  if (!touchEnabled || !portrait) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-ink/95 text-white text-center px-8">
      <RotateCcw className="h-16 w-16 animate-pulse" strokeWidth={2.5} />
      <p className="text-xl font-bold">{t("orientation.rotate")}</p>
    </div>
  );
};
