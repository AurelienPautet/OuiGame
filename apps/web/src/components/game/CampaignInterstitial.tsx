import { useEffect, useRef } from "react";
import {
  Heart,
  HeartCrack,
  Clock,
  Skull,
  Crosshair,
  Target,
  Hammer,
  CheckCircle2,
} from "lucide-react";
import { formatTimeMs } from "../../lib/formatTime";
import { OverlayScrim, OverlayPanel, Stat, StatGrid } from "./overlay";

/**
 * Per-level stats accrued during a round, as built by the GameEngine's
 * solo game-over payload.
 */
export interface LevelStats {
  shots?: number;
  hits?: number;
  kills?: number;
  deaths?: number;
  plants?: number;
  blocksDestroyed?: number;
}

/**
 * Between-level screen data, assembled by GameCanvas's game-over handler. The
 * `commit` field records which deferred transition to apply on continue.
 */
export interface InterstitialData {
  type: "win" | "lose";
  commit?: "advance" | "retry";
  gainedLife?: boolean;
  livesBefore: number;
  livesAfter: number;
  levelNumber: number;
  totalLevels: number;
  stats?: LevelStats;
  timeMs: number;
}

/**
 * CampaignInterstitial - shown between campaign levels (after a clear or a death
 * that isn't terminal). Displays the level's stats and animates the life change.
 */
interface CampaignInterstitialProps {
  data: InterstitialData | null;
  onContinue: () => void;
}

// How long the between-level screen stays up before auto-advancing (ms).
function durationFor(data: InterstitialData | null): number {
  if (!data) return 2200;
  return data.type === "win" ? (data.gainedLife ? 2800 : 2200) : 2200;
}

export const CampaignInterstitial = ({
  data,
  onContinue,
}: CampaignInterstitialProps) => {
  // Keep the latest onContinue without restarting the timer.
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  // Auto-advance after a short delay — no click needed.
  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(() => onContinueRef.current?.(), durationFor(data));
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  const {
    type,
    gainedLife,
    livesBefore,
    livesAfter,
    levelNumber,
    totalLevels,
    stats = {},
    timeMs,
  } = data;
  const delayMs = durationFor(data);

  const isWin = type === "win";
  const shots = stats.shots ?? 0;
  const accuracy =
    shots > 0 ? Math.round(((stats.hits ?? 0) / shots) * 100) : 0;

  // Hearts: show the steady hearts plus the one that is changing (animated).
  const steady = Math.min(isWin && gainedLife ? livesBefore : livesAfter, 9);
  const showDelta = isWin ? gainedLife : true; // a life is always lost on death

  return (
    <OverlayScrim>
      <OverlayPanel
        tone={isWin ? "win" : "lose"}
        icon={
          isWin ? (
            <CheckCircle2 className="w-14 h-14 text-green" />
          ) : (
            <Skull className="w-14 h-14 text-red" />
          )
        }
        title={isWin ? "Level Cleared!" : "You Died"}
        subtitle={`Level ${levelNumber} of ${totalLevels}`}
        footer={
          <div className="w-full">
            <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue"
                style={{
                  animation: `barCountdown ${delayMs}ms linear forwards`,
                }}
              />
            </div>
            <p className="text-center text-xs text-white/40 mt-1.5">
              {isWin ? "Next level…" : "Retrying…"}
            </p>
          </div>
        }
      >
        {/* Lives row with the changing heart animated */}
        <div className="flex items-center gap-1 h-10">
          {Array.from({ length: steady }).map((_, i) => (
            <Heart key={i} className="w-7 h-7 fill-red text-red" />
          ))}
          {showDelta &&
            (isWin ? (
              <Heart className="w-7 h-7 fill-green text-green animate-[lifeGain_0.7s_ease-out_both]" />
            ) : (
              <HeartCrack className="w-7 h-7 fill-red text-red animate-[lifeLoss_0.9s_ease-in_0.2s_both]" />
            ))}
        </div>
        <p
          className={`-mt-2 text-sm font-bold ${
            isWin && gainedLife
              ? "text-green"
              : isWin
                ? "text-white/50"
                : "text-red"
          }`}
        >
          {isWin && gainedLife
            ? "+1 life!"
            : isWin
              ? `${livesAfter} lives left`
              : `-1 life · ${livesAfter} left`}
        </p>

        {/* Level stats */}
        <StatGrid>
          <Stat
            layout="cell"
            icon={<Clock className="w-4 h-4 text-blue" />}
            label="Time"
            value={formatTimeMs(timeMs)}
          />
          <Stat
            layout="cell"
            icon={<Skull className="w-4 h-4 text-blue" />}
            label="Kills"
            value={stats.kills || 0}
          />
          <Stat
            layout="cell"
            icon={<Target className="w-4 h-4 text-green" />}
            label="Accuracy"
            value={`${accuracy}%`}
          />
          <Stat
            layout="cell"
            icon={<Crosshair className="w-4 h-4 text-yellow" />}
            label="Shots"
            value={stats.shots || 0}
          />
          {(stats.blocksDestroyed || 0) > 0 && (
            <Stat
              layout="cell"
              icon={<Hammer className="w-4 h-4 text-white/70" />}
              label="Blocks"
              value={stats.blocksDestroyed ?? 0}
            />
          )}
        </StatGrid>
      </OverlayPanel>
    </OverlayScrim>
  );
};
