import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { onAuthChange } from "../api/authEvents";

const SERVER_URL = import.meta.env.PROD
  ? "https://wiitank.pautet.net"
  : "http://localhost:8000";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    // The auth callback is re-read on every (re)connect, so a fresh token is
    // sent automatically after a reconnect.
    const sock = io(SERVER_URL, {
      auth: (cb) => cb({ token: localStorage.getItem("session_id") || null }),
    });

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
