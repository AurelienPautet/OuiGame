import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children at true window size, escaping the surrounding stage's CSS
 * `transform: scale()`. A `transform` on an ancestor scales even `position:
 * fixed` descendants, so the only clean escape is a portal to a node outside the
 * transformed stage — here, a host appended to <body>.
 *
 * The host is `pointer-events-none` so it never blocks the canvas underneath;
 * interactive children (touch controls, overlay scrims) re-enable pointer
 * events on themselves.
 */
export const FixedUiLayer = ({ children }: { children: ReactNode }) => {
  // Created once on first render so the portal target exists immediately; it is
  // attached to / detached from <body> by the effect below.
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 pointer-events-none";
    return el;
  });

  useEffect(() => {
    document.body.appendChild(host);
    return () => {
      document.body.removeChild(host);
    };
  }, [host]);

  return createPortal(children, host);
};
