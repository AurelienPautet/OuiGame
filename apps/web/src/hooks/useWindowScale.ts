import { useEffect, useState } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvas";

// Computes the factor that fits the fixed CANVAS_WIDTH×CANVAS_HEIGHT stage into
// the current window. We "contain" (use the smaller axis ratio) so the whole
// arena is always visible, then snap the result to whole device pixels so the
// CSS-scaled canvases don't land on sub-pixel boundaries and blur.
export const useWindowScale = (): number => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const widthRatio = window.innerWidth / CANVAS_WIDTH;
      const heightRatio = window.innerHeight / CANVAS_HEIGHT;
      const raw = Math.min(widthRatio, heightRatio);
      // Snap to whole device pixels to avoid sub-pixel blur on the scaled canvas.
      const dpr = window.devicePixelRatio || 1;
      setScale(Math.floor(raw * dpr) / dpr);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  return scale;
};
