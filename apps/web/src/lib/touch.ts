// Touch-device detection + the resolved "should we show on-screen controls?"
// decision, combining the hardware capability with the user's Settings override.
import { useEffect, useState } from "react";
import { useSettings } from "../contexts";

/** True on touch / coarse-pointer hardware (phones, tablets, touch laptops). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches)
  );
}

/**
 * Whether the on-screen touch controls should be active right now. Honours the
 * Settings override: "on"/"off" force it, "auto" defers to device detection
 * (re-evaluated if the pointer capability changes, e.g. a tablet docking).
 */
export function useTouchControlsEnabled(): boolean {
  const { settings } = useSettings();
  const mode = settings.touchControls;
  const [detected, setDetected] = useState(isTouchDevice);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => setDetected(isTouchDevice());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (mode === "on") return true;
  if (mode === "off") return false;
  return detected;
}

/** True when the viewport is taller than it is wide (portrait). */
export function isPortrait(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(orientation: portrait)").matches;
  }
  return window.innerHeight > window.innerWidth;
}

/** Reactive portrait/landscape orientation, updated as the device rotates. */
export function useIsPortrait(): boolean {
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

  return portrait;
}
