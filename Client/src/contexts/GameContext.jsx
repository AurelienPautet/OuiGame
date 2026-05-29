import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { colorFromIndex } from "../constants/tankColors";

const GameContext = createContext(null);

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState({
    isPlaying: false,
    isPaused: false,
    mode: null, // 'solo' | 'online'
    levelId: null,
    roomId: null,
    playerName: "",
    tankColors: {
      body: "orange",
      turret: "orange",
    },
    theme: 1,
  });

  // Start solo game with a level
  const startSoloGame = useCallback((levelId) => {
    // Load player name and colors from localStorage
    const playerName = localStorage.getItem("playerName") || "Player";

    setGameState({
      isPlaying: true,
      isPaused: false,
      mode: "solo",
      levelId,
      roomId: null,
      playerName,
      tankColors: {
        body: colorFromIndex(localStorage.getItem("body")),
        turret: colorFromIndex(localStorage.getItem("turret")),
      },
    });
  }, []);

  // Start online game by joining a room
  const startOnlineGame = useCallback((roomId) => {
    const playerName = localStorage.getItem("playerName") || "Player";

    setGameState({
      isPlaying: true,
      isPaused: false,
      mode: "online",
      levelId: null,
      roomId,
      playerName,
      tankColors: {
        body: colorFromIndex(localStorage.getItem("body")),
        turret: colorFromIndex(localStorage.getItem("turret")),
      },
    });
  }, []);

  const pauseGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const quitGame = useCallback(() => {
    setGameState({
      isPlaying: false,
      isPaused: false,
      mode: null,
      levelId: null,
      roomId: null,
      playerName: "",
      tankColors: { body: "orange", turret: "orange" },
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      theme: prev.theme < 6 ? prev.theme + 1 : 1,
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...gameState,
      startSoloGame,
      startOnlineGame,
      pauseGame,
      resumeGame,
      quitGame,
      cycleTheme,
    }),
    [
      gameState,
      startSoloGame,
      startOnlineGame,
      pauseGame,
      resumeGame,
      quitGame,
      cycleTheme,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
