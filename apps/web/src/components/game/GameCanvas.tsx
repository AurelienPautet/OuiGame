import { useEffect, useRef, useCallback, useState } from "react";
import {
  useGame,
  useSocket,
  useModal,
  useSettings,
  MODALS,
} from "../../contexts";
import { GameEngine } from "../../engine/GameEngine";
import { EndGameScreen } from "./EndGameScreen";
import type { SoloGameResult } from "./EndGameScreen";
import { CountdownOverlay } from "./CountdownOverlay";
import { LivesHud } from "./LivesHud";
import { CampaignEndScreen } from "./CampaignEndScreen";
import { CampaignInterstitial } from "./CampaignInterstitial";
import type { InterstitialData, LevelStats } from "./CampaignInterstitial";
import type { WinnerPayload } from "@ouigame/shared/types";
import { useSubmitSoloRound, useSubmitCampaignRun } from "../../hooks/api";
import { LIFE_EVERY } from "../../constants/campaign";
import { PauseOverlay } from "./PauseOverlay";
import { SettingsModal } from "../modals/SettingsModal";
import { GameCursor } from "./GameCursor";
import { tankColors as resolveTankColors, palette } from "../../theme/palette";

interface GameCanvasProps {
  scale?: number;
}

// History sentinel used to map the browser Back button to "quit the game".
// While a game is mounted we push one entry carrying this flag; popping it
// (via Back, or our own history.back) is what triggers the quit. The flag is a
// plain extra key so it coexists with React Router's own history state.
const isInGameHistoryEntry = () =>
  Boolean(
    (window.history.state as { ouigameInGame?: boolean } | null)?.ouigameInGame
  );

export const GameCanvas = ({ scale = 1 }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // WebGL output canvas. The two 2D canvases above become texture sources for
  // the post-processing chain (bloom / shockwave); this shows the composited,
  // post-processed result on top. Falls back to the 2D canvases if WebGL fails.
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // True once an engine reports a live WebGL post-processor (drives which
  // canvas is shown).
  const [postActive, setPostActive] = useState(false);
  const [isEndGameVisible, setIsEndGameVisible] = useState(false);
  const [soloResult, setSoloResult] = useState<SoloGameResult | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  // Between-level screen for campaigns.
  const [interstitial, setInterstitial] = useState<InterstitialData | null>(
    null
  );

  const {
    mode,
    levelId,
    roomId,
    playerName,
    tankColors,
    pauseGame,
    quitGame,
    isPaused,
    resumeGame,
    theme,
    runNonce,
    // Campaign run state + actions
    campaignId,
    campaignLevelIds,
    campaignIndex,
    lives,
    runStartTime,
    campaignRunResult,
    startCampaign,
    campaignAdvance,
    campaignLoseLife,
  } = useGame();
  const { socket } = useSocket()!;
  const { openModal } = useModal();
  const { settings } = useSettings();

  // In-game settings overlay (opened from the pause menu). Local state rather
  // than ModalContext, since ModalRenderer isn't mounted over the game stage.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mutations for submitting results
  const submitSoloRoundMutation = useSubmitSoloRound();
  const submitCampaignRunMutation = useSubmitCampaignRun();

  // Refs for stable access in effect
  const playerNameRef = useRef(playerName);
  const tankColorsRef = useRef(tankColors);
  // Latest settings, read when an engine is created without retriggering the
  // creation effect on every settings change (live changes flow through the
  // dedicated effect below).
  const settingsRef = useRef(settings);

  useEffect(() => {
    playerNameRef.current = playerName;
    tankColorsRef.current = tankColors;
    settingsRef.current = settings;
  }, [playerName, tankColors, settings]);

  // Push effect toggles to the running engine whenever they change (live).
  useEffect(() => {
    engineRef.current?.applyEffects(settings.effects);
  }, [settings.effects]);

  // Listen for winner event to blur canvases (online mode)
  useEffect(() => {
    if (!socket) return;

    const handleWinner = (data: WinnerPayload) => {
      setIsEndGameVisible(true);
      // Hide after waiting time - countdown will be triggered by server
      setTimeout(() => {
        setIsEndGameVisible(false);
      }, data.waitingtime);
    };

    // Listen for countdown start from server (after respawn in multiplayer)
    const handleCountdownStartServer = () => {
      setShowCountdown(true);
      // Server controls the timing, client just shows the UI
    };

    socket.on("winner", handleWinner);
    socket.on("countdown_start", handleCountdownStartServer);

    return () => {
      socket.off("winner", handleWinner);
      socket.off("countdown_start", handleCountdownStartServer);
    };
  }, [socket]);

  // Handle countdown start callback from engine
  const handleCountdownStart = useCallback(() => {
    setShowCountdown(true);
  }, []);

  // Handle countdown complete - tell engine to start gameplay
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    if (engineRef.current) {
      engineRef.current.endCountdown();
    }
  }, []);

  // Game over callback. In solo/online it shows the end screen; in campaign it
  // drives the run (advance / retry / record run). The per-level solo round is
  // always submitted so per-level stats accrue in both modes.
  const handleGameOver = useCallback(
    (result: SoloGameResult) => {
      const isWin = result.result === "win";

      // Per-level solo stats (works for both solo and campaign levels)
      if (levelId) {
        submitSoloRoundMutation.mutate({
          levelId,
          success: isWin,
          timeMs: (result.timeElapsed || 0) * 1000,
          kills: result.stats?.kills || 0,
          deaths: result.stats?.deaths || 0,
          shots: result.stats?.shots || 0,
          hits: result.stats?.hits || 0,
          plants: result.stats?.plants || 0,
          blocksDestroyed: result.stats?.blocksDestroyed || 0,
        });
      }

      if (mode !== "campaign") {
        setSoloResult(result);
        setIsEndGameVisible(true);
        return;
      }

      // --- Campaign run flow ---
      // In campaign mode the run always has an id (set by startCampaign).
      if (campaignId == null) return;
      const total = campaignLevelIds.length;
      const levelStats: LevelStats = result.stats || {};
      const timeMs = (result.timeElapsed || 0) * 1000;

      if (isWin) {
        const clearedCount = campaignIndex + 1; // 1-based count cleared
        const isComplete = clearedCount >= total;
        if (isComplete) {
          // Terminal: record the run and show the end screen directly.
          const outcome = campaignAdvance();
          if (outcome.type === "complete") {
            submitCampaignRunMutation.mutate({
              campaignId,
              levelsCleared: outcome.levelsCleared,
              livesLeft: outcome.livesLeft,
              completed: true,
              timeMs: outcome.timeMs,
            });
          }
          setIsEndGameVisible(true);
        } else {
          // Non-terminal: pause on the interstitial; commit advance on continue.
          const gainedLife = clearedCount % LIFE_EVERY === 0;
          setInterstitial({
            type: "win",
            commit: "advance",
            gainedLife,
            livesBefore: lives,
            livesAfter: gainedLife ? lives + 1 : lives,
            levelNumber: clearedCount,
            totalLevels: total,
            stats: levelStats,
            timeMs,
          });
        }
      } else {
        const willBeOver = lives - 1 <= 0;
        if (willBeOver) {
          const outcome = campaignLoseLife();
          if (outcome.type === "over") {
            submitCampaignRunMutation.mutate({
              campaignId,
              levelsCleared: outcome.levelsCleared,
              livesLeft: 0,
              completed: false,
              timeMs: outcome.timeMs,
            });
          }
          setIsEndGameVisible(true);
        } else {
          setInterstitial({
            type: "lose",
            commit: "retry",
            livesBefore: lives,
            livesAfter: lives - 1,
            levelNumber: campaignIndex + 1,
            totalLevels: total,
            stats: levelStats,
            timeMs,
          });
        }
      }
    },
    [
      levelId,
      mode,
      campaignId,
      campaignIndex,
      campaignLevelIds,
      lives,
      submitSoloRoundMutation,
      submitCampaignRunMutation,
      campaignAdvance,
      campaignLoseLife,
    ]
  );

  // Continue from the between-level screen: commit the deferred transition,
  // which changes context state and restarts the engine on the next/same level.
  const handleInterstitialContinue = useCallback(() => {
    const commit = interstitial?.commit;
    setInterstitial(null);
    if (commit === "advance") campaignAdvance();
    else if (commit === "retry") campaignLoseLife();
  }, [interstitial, campaignAdvance, campaignLoseLife]);

  // Handle pause toggle
  const handlePause = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent event propagation if triggered by click
      if (e && e.stopPropagation) e.stopPropagation();

      if (isPaused) {
        resumeGame();
        engineRef.current?.resume();
      } else {
        pauseGame();
        engineRef.current?.pause();
      }
    },
    [isPaused, pauseGame, resumeGame]
  );

  // Handle quit
  const handleQuit = useCallback(() => {
    const wasSolo = mode === "solo";
    const wasCampaign = mode === "campaign";

    // Quitting mid-run still records progress so partial completion counts.
    if (
      wasCampaign &&
      !campaignRunResult &&
      campaignIndex >= 1 &&
      campaignId != null
    ) {
      submitCampaignRunMutation.mutate({
        campaignId,
        levelsCleared: campaignIndex,
        livesLeft: lives,
        completed: false,
        timeMs: Date.now() - runStartTime,
      });
    }

    setSoloResult(null);
    setIsEndGameVisible(false);
    setShowCountdown(false);
    setInterstitial(null);
    engineRef.current?.quit();
    quitGame();

    if (wasSolo) {
      openModal(MODALS.LEVEL_SELECTOR);
    } else if (wasCampaign) {
      openModal(MODALS.CAMPAIGN_SELECTOR);
    }
  }, [
    quitGame,
    mode,
    openModal,
    campaignRunResult,
    campaignIndex,
    lives,
    campaignId,
    runStartTime,
    submitCampaignRunMutation,
  ]);

  // Keep the latest quit handler reachable from the mount-only popstate effect
  // below without making that effect depend on it (which would re-push history).
  const handleQuitRef = useRef(handleQuit);
  useEffect(() => {
    handleQuitRef.current = handleQuit;
  }, [handleQuit]);

  // Quitting is funnelled through browser history so the Back button and the
  // in-game Quit buttons share one path: both pop the sentinel entry, and the
  // resulting popstate runs the real quit. UI buttons therefore just ask the
  // history to go back (falling back to a direct quit if the sentinel is gone).
  const requestQuit = useCallback(() => {
    if (isInGameHistoryEntry()) {
      window.history.back();
    } else {
      handleQuit();
    }
  }, [handleQuit]);

  // Make the browser Back key quit the game. We push one sentinel entry when the
  // game mounts; pressing Back (or our own history.back from a Quit button) pops
  // it and fires popstate, which we treat as a quit. Guarding the push on the
  // sentinel keeps it to a single entry even under StrictMode's double-invoke.
  useEffect(() => {
    if (!isInGameHistoryEntry()) {
      window.history.pushState(
        {
          ...(window.history.state as Record<string, unknown> | null),
          ouigameInGame: true,
        },
        ""
      );
    }
    const onPopState = () => handleQuitRef.current();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Handle replay - creates fresh engine instance
  const handleReplay = useCallback(() => {
    setSoloResult(null);
    setIsEndGameVisible(false);
    setShowCountdown(false);

    // Cleanup old engine completely
    if (engineRef.current) {
      engineRef.current.quit();
      engineRef.current = null;
    }

    // Create a fresh engine
    if (canvasRef.current && fadingCanvasRef.current && socket && levelId) {
      const engine = new GameEngine(
        canvasRef.current,
        fadingCanvasRef.current,
        glCanvasRef.current,
        socket
      );
      engineRef.current = engine;
      setPostActive(engine.hasPostProcessing());
      engine.applyEffects(settingsRef.current.effects);

      // Set callbacks
      engine.onPause = () => handlePause();
      engine.onQuit = requestQuit;
      engine.onGameOver = handleGameOver;
      engine.onCountdownStart = handleCountdownStart;
      engine.setScale(scale);

      // Start the game (countdown will be triggered by engine)
      engine.startSolo(levelId, playerNameRef.current, tankColorsRef.current);
    }
  }, [
    levelId,
    socket,
    scale,
    handlePause,
    requestQuit,
    handleGameOver,
    handleCountdownStart,
  ]);

  // Retry the current level from the pause screen (clears pause state first).
  const handleRetry = useCallback(() => {
    resumeGame();
    handleReplay();
  }, [resumeGame, handleReplay]);

  // Replay an entire campaign from level 1 (campaign end screen).
  const handleCampaignReplay = useCallback(() => {
    if (campaignId == null) return;
    setSoloResult(null);
    setIsEndGameVisible(false);
    setShowCountdown(false);
    setInterstitial(null);
    startCampaign({ campaignId, levelIds: campaignLevelIds });
  }, [startCampaign, campaignId, campaignLevelIds]);

  // Update engine scale when window is resized
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setScale(scale);
    }
  }, [scale]);

  // Update engine theme
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTheme(theme);
    }
  }, [theme]);

  // Initialize engine when game starts
  useEffect(() => {
    if (!canvasRef.current || !socket) return;

    // Cleanup previous engine if exists
    if (engineRef.current) {
      engineRef.current.quit();
    }

    const engine = new GameEngine(
      canvasRef.current,
      fadingCanvasRef.current,
      glCanvasRef.current,
      socket
    );
    engineRef.current = engine;
    setPostActive(engine.hasPostProcessing());
    engine.applyEffects(settingsRef.current.effects);

    // Start the appropriate game mode. Campaign plays one solo level at a time;
    // advancing/retrying changes levelId/runNonce which re-runs this effect.
    const startGame = async () => {
      try {
        if ((mode === "solo" || mode === "campaign") && levelId) {
          await engine.startSolo(
            levelId,
            playerNameRef.current,
            tankColorsRef.current
          );
        } else if (mode === "online" && roomId) {
          await engine.startOnline(
            roomId,
            playerNameRef.current,
            tankColorsRef.current
          );
        }
      } catch (err) {
        console.error("Failed to start game:", err);
      }
    };

    startGame();

    // Cleanup on unmount
    return () => {
      engine.quit();
      engineRef.current = null;
    };
  }, [mode, levelId, roomId, runNonce, socket]);

  // Update engine callbacks separately
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.onPause = () => handlePause();
      engineRef.current.onQuit = requestQuit;
      engineRef.current.onGameOver = handleGameOver;
      engineRef.current.onCountdownStart = handleCountdownStart;
    }
  }, [handlePause, requestQuit, handleGameOver, handleCountdownStart]);

  // Handle ESC key for pause. Pausing is allowed during the countdown too (it
  // freezes the count). While the settings overlay is open, let Esc reach the
  // dialog (close it) instead of toggling pause — otherwise it would also
  // resume the game underneath.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !settingsOpen) {
        if (e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        handlePause();
      } else if (e.key === "Shift" && !e.repeat) {
        engineRef.current?.toggleDebug();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handlePause, settingsOpen]);

  // Canvas blur style when an overlay (end screen / interstitial) is visible
  const canvasBlurStyle =
    isEndGameVisible || interstitial ? { filter: "blur(4px)" } : {};

  // Show the custom reticle (and hide the OS cursor) only during live play —
  // when an overlay is up we hand the native pointer back so its buttons are
  // clickable. The reticle is tinted with the player's turret colour.
  const overlayUp =
    isPaused || isEndGameVisible || !!interstitial || !!campaignRunResult;
  const showCursor = !overlayUp;
  const turretFill = resolveTankColors(tankColors.turret).fill;
  const cursorColor = turretFill === "transparent" ? palette.red : turretFill;

  return (
    <div
      className="absolute inset-0 w-full h-full flex items-center justify-center bg-field"
      style={{ cursor: showCursor ? "none" : "default" }}
    >
      {/* Fading canvas (field layer). A texture source for the WebGL canvas
          when post-processing is active, so it is hidden in that case. */}
      <canvas
        ref={fadingCanvasRef}
        className="absolute"
        style={{
          width: 1150,
          height: 800,
          ...(postActive ? { visibility: "hidden" } : {}),
          ...canvasBlurStyle,
        }}
      />
      {/* Main game canvas. When post-processing is active this is only a
          texture source for the WebGL canvas below, so it is hidden. */}
      <canvas
        ref={canvasRef}
        className="absolute z-10"
        style={{
          width: 1150,
          height: 800,
          ...(postActive ? { visibility: "hidden" } : {}),
          ...canvasBlurStyle,
        }}
      />
      {/* WebGL post-processing output (bloom / shockwave). Shown only when the
          GL context initialised; otherwise the 2D canvas above is used. */}
      <canvas
        ref={glCanvasRef}
        className="absolute z-10"
        style={{
          width: 1150,
          height: 800,
          ...(postActive ? {} : { display: "none" }),
          ...canvasBlurStyle,
        }}
      />

      {/* Custom in-game pointer (replaces the OS cursor during play) */}
      {showCursor && <GameCursor color={cursorColor} />}

      {/* Campaign lives / progress HUD */}
      {mode === "campaign" && !campaignRunResult && !interstitial && (
        <LivesHud
          lives={lives}
          levelIndex={campaignIndex + 1}
          totalLevels={campaignLevelIds.length}
        />
      )}

      {/* Countdown overlay (freezes while paused) */}
      <CountdownOverlay
        isActive={showCountdown}
        isPaused={isPaused}
        onComplete={handleCountdownComplete}
      />

      {/* Pause overlay (can be opened during the countdown too) */}
      {isPaused && (
        <PauseOverlay
          onResume={handlePause}
          onQuit={requestQuit}
          onSettings={() => setSettingsOpen(true)}
          onRetry={
            mode === "solo" || mode === "campaign" ? handleRetry : undefined
          }
        />
      )}

      {/* Settings overlay (opened from the pause menu) */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* End game screen overlay (solo / online) */}
      {mode !== "campaign" && (
        <EndGameScreen
          externalResult={soloResult}
          onReplay={handleReplay}
          onQuit={requestQuit}
          levelId={levelId}
        />
      )}

      {/* Between-level screen (stats + life animation) */}
      {mode === "campaign" && interstitial && !campaignRunResult && (
        <CampaignInterstitial
          data={interstitial}
          onContinue={handleInterstitialContinue}
        />
      )}

      {/* Campaign end screen overlay */}
      {mode === "campaign" && campaignRunResult && (
        <CampaignEndScreen
          result={campaignRunResult}
          totalLevels={campaignLevelIds.length}
          onReplay={handleCampaignReplay}
          onQuit={requestQuit}
        />
      )}
    </div>
  );
};
