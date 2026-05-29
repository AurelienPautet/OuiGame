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

const STARTING_LIVES = 3;
const LIFE_EVERY = 5; // gain a life after clearing every Nth level

const initialState = {
  isPlaying: false,
  isPaused: false,
  mode: null, // 'solo' | 'online' | 'campaign'
  levelId: null,
  roomId: null,
  playerName: "",
  tankColors: {
    body: "orange",
    turret: "orange",
  },
  theme: 1,
  // Campaign run state (mode === 'campaign')
  campaignId: null,
  campaignLevelIds: [],
  campaignIndex: 0,
  lives: 0,
  runStartTime: 0,
  runNonce: 0, // bumped to force the engine to (re)start the current level
  campaignRunResult: null, // null | { completed, levelsCleared, livesLeft, timeMs }
};

const localColors = () => ({
  body: colorFromIndex(localStorage.getItem("body")),
  turret: colorFromIndex(localStorage.getItem("turret")),
});

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState(initialState);

  // Start solo game with a level
  const startSoloGame = useCallback((levelId) => {
    const playerName = localStorage.getItem("playerName") || "Player";
    setGameState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      mode: "solo",
      levelId,
      roomId: null,
      playerName,
      tankColors: localColors(),
      campaignId: null,
      campaignLevelIds: [],
      campaignIndex: 0,
      lives: 0,
      campaignRunResult: null,
      runNonce: prev.runNonce + 1,
    }));
  }, []);

  // Start online game by joining a room
  const startOnlineGame = useCallback((roomId) => {
    const playerName = localStorage.getItem("playerName") || "Player";
    setGameState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      mode: "online",
      levelId: null,
      roomId,
      playerName,
      tankColors: localColors(),
      campaignId: null,
      campaignRunResult: null,
    }));
  }, []);

  // Start a campaign run: play the ordered levels with a shared lives pool.
  const startCampaign = useCallback(({ campaignId, levelIds }) => {
    if (!Array.isArray(levelIds) || levelIds.length === 0) return;
    const playerName = localStorage.getItem("playerName") || "Player";
    setGameState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      mode: "campaign",
      levelId: levelIds[0],
      roomId: null,
      playerName,
      tankColors: localColors(),
      campaignId,
      campaignLevelIds: levelIds,
      campaignIndex: 0,
      lives: STARTING_LIVES,
      runStartTime: Date.now(),
      runNonce: prev.runNonce + 1,
      campaignRunResult: null,
    }));
  }, []);

  // Called after clearing the current campaign level. Returns the outcome so
  // the caller can record the run / trigger UI. Computes from current state.
  const campaignAdvance = useCallback(() => {
    const { campaignIndex, campaignLevelIds, lives, runStartTime } = gameState;
    const clearedCount = campaignIndex + 1; // 1-based count of cleared levels
    const gainedLife = clearedCount % LIFE_EVERY === 0;
    const newLives = gainedLife ? lives + 1 : lives;

    if (clearedCount >= campaignLevelIds.length) {
      const result = {
        completed: true,
        levelsCleared: campaignLevelIds.length,
        livesLeft: newLives,
        timeMs: Date.now() - runStartTime,
      };
      setGameState((prev) => ({
        ...prev,
        lives: newLives,
        campaignRunResult: result,
      }));
      return { type: "complete", ...result };
    }

    const nextIndex = campaignIndex + 1;
    setGameState((prev) => ({
      ...prev,
      campaignIndex: nextIndex,
      levelId: campaignLevelIds[nextIndex],
      lives: newLives,
      runNonce: prev.runNonce + 1,
    }));
    return {
      type: "next",
      gainedLife,
      nextLevelId: campaignLevelIds[nextIndex],
    };
  }, [gameState]);

  // Called after dying on the current campaign level. Returns "retry" (lives
  // remain; same level restarts) or "over" (run ends).
  const campaignLoseLife = useCallback(() => {
    const { lives, campaignIndex, runStartTime } = gameState;
    if (lives - 1 <= 0) {
      const result = {
        completed: false,
        levelsCleared: campaignIndex,
        livesLeft: 0,
        timeMs: Date.now() - runStartTime,
      };
      setGameState((prev) => ({ ...prev, lives: 0, campaignRunResult: result }));
      return { type: "over", ...result };
    }
    setGameState((prev) => ({
      ...prev,
      lives: prev.lives - 1,
      runNonce: prev.runNonce + 1,
    }));
    return { type: "retry" };
  }, [gameState]);

  const pauseGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const quitGame = useCallback(() => {
    setGameState((prev) => ({ ...initialState, theme: prev.theme }));
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
      startCampaign,
      campaignAdvance,
      campaignLoseLife,
      pauseGame,
      resumeGame,
      quitGame,
      cycleTheme,
    }),
    [
      gameState,
      startSoloGame,
      startOnlineGame,
      startCampaign,
      campaignAdvance,
      campaignLoseLife,
      pauseGame,
      resumeGame,
      quitGame,
      cycleTheme,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
