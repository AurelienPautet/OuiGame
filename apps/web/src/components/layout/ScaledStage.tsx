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
    // Size the stage box to the *dynamic* viewport (dvw/dvh), NOT 100vw/100vh.
    // useWindowScale fits the 1150×800 arena into window.innerWidth/innerHeight
    // (the visible area). On mobile, 100vh is the *large* viewport (the height
    // with the browser's address bar retracted), which is taller than the
    // visible area — so the old `h-screen` box centred the height-fitted arena
    // in a box taller than the screen and pushed its bottom rows off-screen (the
    // whole arena wasn't visible). dvw/dvh track the currently visible viewport,
    // so the box matches what we scaled into and the entire arena shows. The
    // w-screen/h-screen classes stay as a 100vw/100vh fallback: a browser that
    // doesn't understand the inline dvw/dvh value drops it and uses the class.
    //
    // The leftover letterbox (a landscape phone is wider than the 23:16 arena)
    // is painted with the same graph-paper field the arena and menus use, so it
    // reads as field rather than dark "black borders".
    <div
      className="w-screen h-screen overflow-hidden graph-paper flex items-center justify-center"
      style={{ width: "100dvw", height: "100dvh" }}
    >
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
