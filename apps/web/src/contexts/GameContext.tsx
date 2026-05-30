import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { colorFromIndex } from "../constants/tankColors";
import { STARTING_LIVES, LIFE_EVERY } from "../constants/campaign";
import { storage } from "../lib/storage";

export type GameMode = "solo" | "online" | "campaign";

export interface TankColors {
  body: string;
  turret: string;
}

export interface CampaignRunResult {
  completed: boolean;
  levelsCleared: number;
  livesLeft: number;
  timeMs: number;
}

export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  mode: GameMode | null;
  levelId: number | null;
  roomId: number | string | null;
  playerName: string;
  tankColors: TankColors;
  theme: number;
  // Campaign run state (mode === 'campaign')
  campaignId: number | null;
  campaignLevelIds: number[];
  campaignIndex: number;
  lives: number;
  runStartTime: number;
  runNonce: number; // bumped to force the engine to (re)start the current level
  campaignRunResult: CampaignRunResult | null;
}

// The outcome returned by the campaign run-state callbacks to their caller.
export type CampaignOutcome =
  | ({ type: "complete" } & CampaignRunResult)
  | { type: "next"; gainedLife: boolean; nextLevelId: number }
  | ({ type: "over" } & CampaignRunResult)
  | { type: "retry" };

interface GameContextValue extends GameState {
  startSoloGame: (levelId: number) => void;
  startOnlineGame: (roomId: number | string) => void;
  startCampaign: (args: { campaignId: number; levelIds: number[] }) => void;
  campaignAdvance: () => CampaignOutcome;
  campaignLoseLife: () => CampaignOutcome;
  pauseGame: () => void;
  resumeGame: () => void;
  quitGame: () => void;
  cycleTheme: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};

const initialState: GameState = {
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

const localColors = (): TankColors => ({
  body: colorFromIndex(storage.getBodyIndex()),
  turret: colorFromIndex(storage.getTurretIndex()),
});

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [gameState, setGameState] = useState<GameState>(initialState);

  // Start solo game with a level
  const startSoloGame = useCallback((levelId: number) => {
    const playerName = storage.getPlayerName() || "Player";
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
  const startOnlineGame = useCallback((roomId: number | string) => {
    const playerName = storage.getPlayerName() || "Player";
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
  const startCampaign = useCallback(
    ({ campaignId, levelIds }: { campaignId: number; levelIds: number[] }) => {
      if (!Array.isArray(levelIds) || levelIds.length === 0) return;
      const playerName = storage.getPlayerName() || "Player";
      setGameState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        mode: "campaign",
        // The `levelIds.length === 0` guard above proves index 0 is present.
        levelId: levelIds[0]!,
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
    },
    []
  );

  // Called after clearing the current campaign level. Returns the outcome so
  // the caller can record the run / trigger UI. Reads gameState directly (so it
  // can return the computed outcome synchronously) and applies the state change
  // via a functional setGameState update. (A ref-stash-inside-updater variant
  // was tried for referential stability but breaks under React's double-invoked
  // updaters — see GameContext.test; that optimization is deferred.)
  const campaignAdvance = useCallback((): CampaignOutcome => {
    const { campaignIndex, campaignLevelIds, lives, runStartTime } = gameState;
    const clearedCount = campaignIndex + 1; // 1-based count of cleared levels
    const gainedLife = clearedCount % LIFE_EVERY === 0;
    const newLives = gainedLife ? lives + 1 : lives;

    if (clearedCount >= campaignLevelIds.length) {
      const result: CampaignRunResult = {
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
    // The early `clearedCount >= campaignLevelIds.length` return above means
    // nextIndex (= clearedCount) is in bounds, so this lookup is defined.
    const nextLevelId = campaignLevelIds[nextIndex]!;
    setGameState((prev) => ({
      ...prev,
      campaignIndex: nextIndex,
      levelId: nextLevelId,
      lives: newLives,
      runNonce: prev.runNonce + 1,
    }));
    return {
      type: "next",
      gainedLife,
      nextLevelId,
    };
  }, [gameState]);

  // Called after dying on the current campaign level. Returns "retry" (lives
  // remain; same level restarts) or "over" (run ends).
  const campaignLoseLife = useCallback((): CampaignOutcome => {
    const { lives, campaignIndex, runStartTime } = gameState;
    if (lives - 1 <= 0) {
      const result: CampaignRunResult = {
        completed: false,
        levelsCleared: campaignIndex,
        livesLeft: 0,
        timeMs: Date.now() - runStartTime,
      };
      setGameState((prev) => ({
        ...prev,
        lives: 0,
        campaignRunResult: result,
      }));
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

  const value = useMemo<GameContextValue>(
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
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
