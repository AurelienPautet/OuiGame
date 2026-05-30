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

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  text: string;
  createdAt: number;
  exiting: boolean;
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

      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title,
          text,
          createdAt: Date.now(),
          exiting: false,
        },
      ]);

      // Start exit animation before removal
      timeoutsRef.current[id] = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        );

        // Remove after animation
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          delete timeoutsRef.current[id];
        }, 500);
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
      addToast(TOAST_TYPES.CONNECTION, "Connection", `${name} connected`);
    };

    const handlePlayerDisconnection = (name: string) => {
      addToast(
        TOAST_TYPES.DISCONNECTION,
        "Disconnection",
        `${name} disconnected`
      );
    };

    const handlePlayerKill = (data: PlayerKillPayload) => {
      const { players, type } = data;
      if (type === "bullet") {
        addToast(
          TOAST_TYPES.BULLET,
          "Kill",
          `${players[0]} killed ${players[1]}`
        );
      } else if (type === "mine") {
        addToast(
          TOAST_TYPES.MINE,
          "Kill",
          `${players[0]} blew up ${players[1]}`
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
