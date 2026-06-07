import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { PlayerKillPayload } from "@ouigame/shared/types";
import { useSocket } from "./SocketContext";
import i18n from "../i18n";
import { playSfx, type VoiceName } from "../audio";

// Toast types with their colors and icons
export const TOAST_TYPES = {
  CONNECTION: "connection",
  DISCONNECTION: "disconnection",
  BULLET: "bullet",
  MINE: "mine",
  INFO: "info",
  ERROR: "error",
  SUCCESS: "success",
} as const;

export type ToastType = (typeof TOAST_TYPES)[keyof typeof TOAST_TYPES];

// The procedural cue each toast type announces itself with.
const TOAST_SOUNDS: Record<ToastType, VoiceName> = {
  [TOAST_TYPES.CONNECTION]: "uiSuccess",
  [TOAST_TYPES.DISCONNECTION]: "uiError",
  [TOAST_TYPES.BULLET]: "notify",
  [TOAST_TYPES.MINE]: "notify",
  [TOAST_TYPES.INFO]: "notify",
  [TOAST_TYPES.ERROR]: "uiError",
  [TOAST_TYPES.SUCCESS]: "uiSuccess",
};

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  text: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (
    type: ToastType,
    title: string,
    text: string,
    duration?: number
  ) => number;
  removeToast: (id: number) => void;
  TOAST_TYPES: typeof TOAST_TYPES;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

let toastId = 0;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // useSocket() may return null when no SocketProvider is mounted; the effect
  // below already no-ops on a null socket, so default to null here.
  const socket = useSocket()?.socket ?? null;
  const timeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Add a new toast
  const addToast = useCallback(
    (type: ToastType, title: string, text: string, duration = 1500) => {
      const id = ++toastId;

      playSfx(TOAST_SOUNDS[type]);

      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title,
          text,
          createdAt: Date.now(),
        },
      ]);

      // Drop it from state after `duration`; AnimatePresence plays the
      // slide-out exit as the element unmounts (no manual exit phase needed).
      timeoutsRef.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timeoutsRef.current[id];
      }, duration);

      return id;
    },
    []
  );

  // Remove a specific toast
  const removeToast = useCallback((id: number) => {
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen to socket events for game notifications
  useEffect(() => {
    if (!socket) return;

    const handlePlayerConnection = (name: string) => {
      addToast(
        TOAST_TYPES.CONNECTION,
        i18n.t("toasts.connection"),
        i18n.t("toasts.connected", { name })
      );
    };

    const handlePlayerDisconnection = (name: string) => {
      addToast(
        TOAST_TYPES.DISCONNECTION,
        i18n.t("toasts.disconnection"),
        i18n.t("toasts.disconnected", { name })
      );
    };

    const handlePlayerKill = (data: PlayerKillPayload) => {
      const { players, type } = data;
      if (type === "bullet") {
        addToast(
          TOAST_TYPES.BULLET,
          i18n.t("toasts.kill"),
          i18n.t("toasts.killedBullet", {
            killer: players[0],
            victim: players[1],
          })
        );
      } else if (type === "mine") {
        addToast(
          TOAST_TYPES.MINE,
          i18n.t("toasts.kill"),
          i18n.t("toasts.killedMine", {
            killer: players[0],
            victim: players[1],
          })
        );
      }
    };

    socket.on("player-connection", handlePlayerConnection);
    socket.on("player-disconnection", handlePlayerDisconnection);
    socket.on("player-kill", handlePlayerKill);

    return () => {
      socket.off("player-connection", handlePlayerConnection);
      socket.off("player-disconnection", handlePlayerDisconnection);
      socket.off("player-kill", handlePlayerKill);

      // Clear all timeouts on unmount
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, [socket, addToast]);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, TOAST_TYPES }}
    >
      {children}
    </ToastContext.Provider>
  );
};
