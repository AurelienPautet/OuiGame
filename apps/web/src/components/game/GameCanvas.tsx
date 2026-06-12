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
import { LobbyOverlay } from "./LobbyOverlay";
import { LivesHud } from "./LivesHud";
import { RunTimer } from "./RunTimer";
import { CampaignEndScreen } from "./CampaignEndScreen";
import { CampaignInterstitial } from "./CampaignInterstitial";
import type { InterstitialData, LevelStats } from "./CampaignInterstitial";
import type { WinnerPayload, LobbyState } from "@ouigame/shared/types";
import { useSubmitSoloRound, useSubmitCampaignRun } from "../../hooks/api";
import { LIFE_EVERY } from "../../constants/campaign";
import { PauseOverlay } from "./PauseOverlay";
import { SettingsModal } from "../modals/SettingsModal";
import { GameCursor } from "./GameCursor";
import { TouchControls } from "./TouchControls";
import { FixedUiLayer } from "./FixedUiLayer";
import { OrientationHint } from "./OrientationHint";
import { useTouchControlsEnabled } from "../../lib/touch";
import { tankColors as resolveTankColors, palette } from "../../theme/palette";

// History sentinel used to map the browser Back button to "quit the game".
// While a game is mounted we push one entry carrying this flag; popping it
// (via Back, or our own history.back) is what triggers the quit. The flag is a
// plain extra key so it coexists with React Router's own history state.
const isInGameHistoryEntry = () =>
  Boolean(
    (window.history.state as { ouigameInGame?: boolean } | null)?.ouigameInGame
  );

// Dev-only introspection handle: lets browser automation (and a curious
// console user) read live room state objectively — e.g. bot positions/mine
// counts during AI verification. Stripped from production builds.
const exposeEngineForDev = (engine: GameEngine) => {
  if (import.meta.env.DEV) {
    (window as unknown as { __ouitankEngine?: GameEngine }).__ouitankEngine =
      engine;
  }
};

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // WebGL output canvas. The two 2D canvases above become texture sources for
  // the post-processing chain (bloom / shockwave); this shows the composited,
  // post-processed result on top. Falls back to the 2D canvases if WebGL fails.
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // Enemies defeated on the current campaign level, carried across a lost life
  // so retrying the level doesn't resurrect them. Reset when the level changes
  // (advance) or a new run starts. A ref (not state) because only the imperative
  // engine restart reads it; it must never trigger a React re-render.
  const defeatedBotIdsRef = useRef<string[]>([]);
  // True once an engine reports a live WebGL post-processor (drives which
  // canvas is shown).
  const [postActive, setPostActive] = useState(false);
  const [isEndGameVisible, setIsEndGameVisible] = useState(false);
  const [soloResult, setSoloResult] = useState<SoloGameResult | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  // Latest lobby_state for the joined online room. Non-null with status
  // "lobby" ⇒ the room is pre-game (frozen arena) and the lobby panel shows.
  const [lobby, setLobby] = useState<LobbyState | null>(null);
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
    testLayout,
    startCampaign,
    campaignAdvance,
    campaignLoseLife,
  } = useGame();
  // True for the editor "test" run: a throwaway in-memory level with no id, so
  // no stats are submitted and quitting returns to the editor (no modal).
  const isTest = testLayout != null;
  const { socket, serverId } = useSocket()!;
  const { openModal } = useModal();
  const { settings } = useSettings();
  const touchEnabled = useTouchControlsEnabled();

  // In-game settings overlay (opened from the pause menu). Local state rather
  // than ModalContext, since ModalRenderer isn't mounted over the game stage.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mutations for submitting results
  const submitSoloRoundMutation = useSubmitSoloRound();
  const submitCampaignRunMutation = useSubmitCampaignRun();

  // Refs for stable access in effect
  const playerNameRef = useRef(playerName);
  const tankColorsRef = useRef(tankColors);
  const serverIdRef = useRef(serverId);
  // In-memory grid for an editor test run (null otherwise). A ref so the engine
  // start/replay effects can read it without depending on it.
  const testLayoutRef = useRef(testLayout);
  // Latest settings, read when an engine is created without retriggering the
  // creation effect on every settings change (live changes flow through the
  // dedicated effect below).
  const settingsRef = useRef(settings);

  useEffect(() => {
    playerNameRef.current = playerName;
    tankColorsRef.current = tankColors;
    settingsRef.current = settings;
    serverIdRef.current = serverId;
    testLayoutRef.current = testLayout;
  }, [playerName, tankColors, settings, serverId, testLayout]);

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
      // Kick off the parachute drop in step with the server countdown.
      engineRef.current?.startSpawnAnimation();
      // Server controls the timing, client just shows the UI
      // The match-start countdown also ends the lobby — drop the panel even
      // if the status-flip lobby_state broadcast got lost.
      setLobby((prev) =>
        prev && prev.status === "lobby" ? { ...prev, status: "playing" } : prev
      );
    };

    // Pre-game lobby snapshots (membership/host/status changes).
    const handleLobbyState = (state: LobbyState) => {
      setLobby(state);
    };

    socket.on("winner", handleWinner);
    socket.on("countdown_start", handleCountdownStartServer);
    socket.on("lobby_state", handleLobbyState);

    return () => {
      socket.off("winner", handleWinner);
      socket.off("countdown_start", handleCountdownStartServer);
      socket.off("lobby_state", handleLobbyState);
    };
  }, [socket]);

  // A stale lobby panel must never survive into another room (GameCanvas does
  // not unmount between rooms — the engine-init effect just re-runs).
  useEffect(() => {
    setLobby(null);
  }, [roomId]);

  // Handle countdown start callback from engine
  const handleCountdownStart = useCallback(() => {
    setShowCountdown(true);
  }, []);

  // Stable reader for the run timer HUD: polls the live engine's elapsed time.
  // Identity is fixed so the RunTimer's rAF loop isn't restarted on re-renders.
  const getElapsedMs = useCallback(
    () => engineRef.current?.getElapsedMs() ?? 0,
    []
  );

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

      // Per-level solo stats (works for both solo and campaign levels). Skipped
      // for an editor test run: the level has no id, so there's nothing to log.
      if (levelId && !isTest) {
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

      // Carry defeated enemies across a lost life: on a loss, remember which
      // bots are already beaten so the level restart (further down, via
      // runNonce) skips them; on a win we move to a fresh level, so clear it.
      // The engine is still alive here (the restart happens on a later render).
      defeatedBotIdsRef.current = isWin
        ? []
        : (engineRef.current?.getDefeatedBotIds() ?? defeatedBotIdsRef.current);

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
      isTest,
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
    setLobby(null);
    setInterstitial(null);
    engineRef.current?.quit();
    quitGame();

    // A test run exits straight back to the editor (rendered underneath); the
    // browse-levels / browse-campaigns modals only make sense for real plays.
    if (isTest) return;
    if (wasSolo) {
      openModal(MODALS.LEVEL_SELECTOR);
    } else if (wasCampaign) {
      openModal(MODALS.CAMPAIGN_SELECTOR);
    }
  }, [
    quitGame,
    mode,
    isTest,
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
    // A voluntary restart (pause → retry) replays the level fresh; it costs no
    // life, so previously defeated enemies come back.
    defeatedBotIdsRef.current = [];

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
      exposeEngineForDev(engine);
      setPostActive(engine.hasPostProcessing());
      engine.applyEffects(settingsRef.current.effects);

      // Set callbacks
      engine.onPause = () => handlePause();
      engine.onQuit = requestQuit;
      engine.onGameOver = handleGameOver;
      engine.onCountdownStart = handleCountdownStart;

      // Start the game (countdown will be triggered by engine). A test replay
      // re-plays the same in-memory layout (no life cost, fresh enemies).
      engine.startSolo(
        levelId,
        playerNameRef.current,
        tankColorsRef.current,
        [],
        testLayoutRef.current ?? undefined
      );
    }
  }, [
    levelId,
    socket,
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
    defeatedBotIdsRef.current = [];
    startCampaign({ campaignId, levelIds: campaignLevelIds });
  }, [startCampaign, campaignId, campaignLevelIds]);

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
    exposeEngineForDev(engine);
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
            tankColorsRef.current,
            // Only campaigns carry defeated enemies across a retry; a solo
            // replay always starts the level fresh.
            mode === "campaign" ? defeatedBotIdsRef.current : [],
            // Editor test run plays this in-memory grid instead of fetching.
            testLayoutRef.current ?? undefined
          );
        } else if (mode === "online" && roomId) {
          await engine.startOnline(
            roomId,
            playerNameRef.current,
            tankColorsRef.current,
            serverIdRef.current
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
  const lobbyUp =
    mode === "online" && roomId != null && lobby?.status === "lobby";
  const overlayUp =
    isPaused ||
    isEndGameVisible ||
    !!interstitial ||
    !!campaignRunResult ||
    lobbyUp;
  const showCursor = !overlayUp;
  const turretFill = resolveTankColors(tankColors.turret).fill;
  const cursorColor = turretFill === "transparent" ? palette.red : turretFill;

  return (
    <>
      {/* Scaled layer: the canvases and the reticle live inside the 1150×800
          stage transform. The reticle is positioned in canvas coordinates, so
          it must scale with the arena. */}
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
      </div>

      {/* Fixed UI layer: rendered at true window size (outside the stage
          transform) so touch controls and menus stay a usable physical size
          on small screens regardless of how much the arena is zoomed. */}
      <FixedUiLayer>
        {/* On-screen touch controls (mobile / touch devices). Hidden whenever an
            overlay is up, mirroring the cursor logic. */}
        {touchEnabled && !overlayUp && (
          <TouchControls
            autoFire={settings.autoFire}
            onPause={() => handlePause()}
            color={cursorColor}
          />
        )}

        {/* Campaign lives / progress HUD */}
        {mode === "campaign" && !campaignRunResult && !interstitial && (
          <LivesHud
            lives={lives}
            levelIndex={campaignIndex + 1}
            totalLevels={campaignLevelIds.length}
          />
        )}

        {/* Solo run timer HUD (hidden once the end screen is up — the final
            time is shown there). */}
        {mode === "solo" && !isEndGameVisible && (
          <RunTimer getElapsedMs={getElapsedMs} />
        )}

        {/* Pre-game lobby panel over the live (frozen) arena. Below the
            countdown overlay so the 3-2-1 paints on top during the handoff. */}
        {lobbyUp && lobby && roomId != null && (
          <LobbyOverlay state={lobby} roomId={roomId} onLeave={requestQuit} />
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
            settingsOpen={settingsOpen}
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
            // A test level has no real id — suppress leaderboard / rating.
            levelId={isTest ? null : levelId}
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

        {/* Rotate-to-landscape prompt (touch + portrait only) */}
        <OrientationHint />
      </FixedUiLayer>
    </>
  );
};
