import { useEffect, useState } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvas";

// Computes the factor that fits the fixed CANVAS_WIDTH×CANVAS_HEIGHT stage into
// the current window. We "contain" (use the smaller axis ratio) so the whole
// arena is always visible. When the stage is scaled UP we snap to whole device
// pixels so the CSS-scaled canvases don't land on sub-pixel boundaries and blur.
export const useWindowScale = (): number => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const widthRatio = window.innerWidth / CANVAS_WIDTH;
      const heightRatio = window.innerHeight / CANVAS_HEIGHT;
      const raw = Math.min(widthRatio, heightRatio);
      // When scaling UP (raw >= 1) snap to whole device pixels so an upscaled
      // canvas stays crisp (no sub-pixel blur). When scaling DOWN (raw < 1) use
      // the exact ratio: flooring `raw * dpr` there snaps the whole stage to a
      // multiple of 1/dpr, which collapses to 0 — an invisible, all-grey stage —
      // on any window smaller than 1150×800 at dpr 1, i.e. most small screens.
      // A down-scaled canvas is resampled regardless, so exact-fit beats snapping.
      const dpr = window.devicePixelRatio || 1;
      setScale(raw >= 1 ? Math.floor(raw * dpr) / dpr : raw);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  return scale;
};
