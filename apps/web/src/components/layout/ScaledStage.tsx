import type { CSSProperties, ReactNode } from "react";
import { ToastContainer } from "../ui";
import { useWindowScale } from "../../hooks/useWindowScale";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/canvas";

interface ScaledStageProps {
  children: ReactNode;
  // GameView sets "none" so the browser doesn't claim touch gestures
  // (scroll/zoom) over the on-screen controls. The editors leave it default.
  touchAction?: CSSProperties["touchAction"];
}

/**
 * The fixed-size 1150×800 stage used by gameplay and the level/campaign editors.
 * It renders its children at that virtual resolution and uniformly scales the
 * whole stage to fit the window (see useWindowScale). Interactive UI that must
 * stay a usable physical size lives OUTSIDE this transform (see FixedUiLayer).
 *
 * The editors raise validation toasts; the ToastContainer here is what renders
 * them while a stage is mounted.
 */
export const ScaledStage = ({ children, touchAction }: ScaledStageProps) => {
  const scale = useWindowScale();
  return (
    <div className="w-screen h-screen overflow-hidden bg-ink flex items-center justify-center">
      <div
        className="relative overflow-hidden"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          ...(touchAction ? { touchAction } : {}),
        }}
      >
        {children}
        <ToastContainer />
      </div>
    </div>
  );
};
