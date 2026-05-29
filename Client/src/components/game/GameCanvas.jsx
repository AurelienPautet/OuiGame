import { useEffect, useRef, useCallback, useState } from "react";
import { useGame, useSocket, useModal, MODALS } from "../../contexts";
import { GameEngine } from "../../engine/GameEngine";
import { EndGameScreen } from "./EndGameScreen";
import { CountdownOverlay } from "./CountdownOverlay";
import { LivesHud } from "./LivesHud";
import { CampaignEndScreen } from "./CampaignEndScreen";
import { CampaignInterstitial } from "./CampaignInterstitial";
import { useSubmitSoloRound, useSubmitCampaignRun } from "../../hooks/api";
import { LIFE_EVERY } from "../../constants/campaign";

export const GameCanvas = ({ scale = 1 }) => {
  const canvasRef = useRef(null);
  const fadingCanvasRef = useRef(null);
  const engineRef = useRef(null);
  const [isEndGameVisible, setIsEndGameVisible] = useState(false);
  const [soloResult, setSoloResult] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  // Between-level screen for campaigns: { type, gainedLife, livesBefore,
  // livesAfter, levelNumber, totalLevels, stats, timeMs, commit }
  const [interstitial, setInterstitial] = useState(null);

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
  const { socket } = useSocket();
  const { openModal } = useModal();

  // Mutations for submitting results
  const submitSoloRoundMutation = useSubmitSoloRound();
  const submitCampaignRunMutation = useSubmitCampaignRun();

  // Refs for stable access in effect
  const playerNameRef = useRef(playerName);
  const tankColorsRef = useRef(tankColors);

  useEffect(() => {
    playerNameRef.current = playerName;
    tankColorsRef.current = tankColors;
  }, [playerName, tankColors]);

  // Listen for winner event to blur canvases (online mode)
  useEffect(() => {
    if (!socket) return;

    const handleWinner = (data) => {
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
    (result) => {
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
      const total = campaignLevelIds.length;
      const levelStats = result.stats || {};
      const timeMs = (result.timeElapsed || 0) * 1000;

      if (isWin) {
        const clearedCount = campaignIndex + 1; // 1-based count cleared
        const isComplete = clearedCount >= total;
        if (isComplete) {
          // Terminal: record the run and show the end screen directly.
          const outcome = campaignAdvance();
          submitCampaignRunMutation.mutate({
            campaignId,
            levelsCleared: outcome.levelsCleared,
            livesLeft: outcome.livesLeft,
            completed: true,
            timeMs: outcome.timeMs,
          });
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
          submitCampaignRunMutation.mutate({
            campaignId,
            levelsCleared: outcome.levelsCleared,
            livesLeft: 0,
            completed: false,
            timeMs: outcome.timeMs,
          });
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
    (e) => {
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
    if (wasCampaign && !campaignRunResult && campaignIndex >= 1) {
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
    if (canvasRef.current && fadingCanvasRef.current && socket) {
      const engine = new GameEngine(
        canvasRef.current,
        fadingCanvasRef.current,
        socket
      );
      engineRef.current = engine;

      // Set callbacks
      engine.onPause = () => handlePause();
      engine.onQuit = handleQuit;
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
    handleQuit,
    handleGameOver,
    handleCountdownStart,
  ]);

  // Replay an entire campaign from level 1 (campaign end screen).
  const handleCampaignReplay = useCallback(() => {
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
      socket
    );
    engineRef.current = engine;

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
      engineRef.current.onQuit = handleQuit;
      engineRef.current.onGameOver = handleGameOver;
      engineRef.current.onCountdownStart = handleCountdownStart;
    }
  }, [handlePause, handleQuit, handleGameOver, handleCountdownStart]);

  // Handle ESC key for pause (but not during countdown)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Escape" && !showCountdown) {
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
  }, [handlePause, showCountdown]);

  // Canvas blur style when an overlay (end screen / interstitial) is visible
  const canvasBlurStyle =
    isEndGameVisible || interstitial ? { filter: "blur(4px)" } : {};

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
      {/* Fading canvas for track trails */}
      <canvas
        ref={fadingCanvasRef}
        className="absolute"
        style={{ width: 1150, height: 800, ...canvasBlurStyle }}
      />
      {/* Main game canvas */}
      <canvas
        ref={canvasRef}
        className="absolute z-10"
        style={{ width: 1150, height: 800, ...canvasBlurStyle }}
      />

      {/* Campaign lives / progress HUD */}
      {mode === "campaign" && !campaignRunResult && !interstitial && (
        <LivesHud
          lives={lives}
          levelIndex={campaignIndex + 1}
          totalLevels={campaignLevelIds.length}
        />
      )}

      {/* Countdown overlay */}
      <CountdownOverlay
        isActive={showCountdown}
        onComplete={handleCountdownComplete}
      />

      {/* Pause overlay */}
      {isPaused && !showCountdown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/50">
          <h2 className="text-4xl font-bold text-white mb-8">PAUSED</h2>
          <div className="flex gap-4">
            <button className="btn btn-primary btn-lg" onClick={handlePause}>
              Resume
            </button>
            <button className="btn btn-error btn-lg" onClick={handleQuit}>
              Quit
            </button>
          </div>
        </div>
      )}

      {/* End game screen overlay (solo / online) */}
      {mode !== "campaign" && (
        <EndGameScreen
          externalResult={soloResult}
          onReplay={handleReplay}
          onQuit={handleQuit}
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
          onQuit={handleQuit}
        />
      )}
    </div>
  );
};
