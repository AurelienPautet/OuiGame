import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { onAuthChange } from "../api/authEvents";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@ouigame/shared/socket";

// VITE_SOCKET_URL (build-time, e.g. the itch.io build) wins; otherwise the
// hosted prod / local dev default — so the normal build is unchanged.
const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.PROD
    ? "https://wiitank.pautet.net"
    : "http://localhost:8000");

// socket.io-client's generic order is <ListenEvents, EmitEvents> = (S2C, C2S).
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: GameSocket | null;
  isConnected: boolean;
  onlineCount: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    // The auth callback is re-read on every (re)connect, so a fresh token is
    // sent automatically after a reconnect.
    // socket.io-client@4's `io()` overloads are not generic, so we assert the
    // returned socket to the typed shape. This keeps full per-event typing on
    // `sock.on`/`sock.emit` below (only the io() call itself is asserted).
    const sock = io(SERVER_URL, {
      auth: (cb) => cb({ token: localStorage.getItem("session_id") || null }),
    }) as GameSocket;

    sock.on("connect", () => {
      setIsConnected(true);
    });

    sock.on("disconnect", () => {
      setIsConnected(false);
    });

    sock.on("online_count", (count) => {
      setOnlineCount(count);
    });

    // Re-authenticate the live socket when the user logs in or out without a
    // full reconnect.
    const unsubscribe = onAuthChange(() => {
      const token = localStorage.getItem("session_id");
      if (token) {
        sock.emit("authenticate", token);
      } else {
        sock.emit("deauthenticate");
      }
    });

    setSocket(sock);

    return () => {
      unsubscribe();
      sock.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineCount }}>
      {children}
    </SocketContext.Provider>
  );
};
