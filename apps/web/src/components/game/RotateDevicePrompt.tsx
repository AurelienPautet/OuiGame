import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";

const isPortrait = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(orientation: portrait)").matches;

/**
 * Full-screen "please rotate" overlay for the fixed-landscape game/editor stage
 * on touch devices held in portrait. The board's aspect ratio is fixed (1150×800)
 * for gameplay fairness, so in portrait it would otherwise be a small strip with
 * large empty bands; nudging the player to landscape gives them the full board.
 *
 * Auto-hides the moment the device is rotated (it listens to the orientation
 * media query). It does NOT CSS-rotate the canvas, so the touch aim/move maths
 * stay in screen space and keep working.
 */
export const RotateDevicePrompt = () => {
  const { t } = useTranslation();
  const [portrait, setPortrait] = useState(isPortrait);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mql = window.matchMedia("(orientation: portrait)");
    const onChange = () => setPortrait(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (!portrait) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink px-10 text-center text-white">
      <RotateCw className="h-16 w-16 animate-pulse" strokeWidth={2.5} />
      <p className="font-display text-2xl font-bold">{t("rotate.title")}</p>
      <p className="max-w-xs text-sm text-white/70">{t("rotate.subtitle")}</p>
    </div>
  );
};
