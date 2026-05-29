import {
  Heart,
  HeartCrack,
  Clock,
  Skull,
  Crosshair,
  Target,
  Hammer,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

function formatTime(ms) {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * CampaignInterstitial - shown between campaign levels (after a clear or a death
 * that isn't terminal). Displays the level's stats and animates the life change.
 *
 * @param {Object} props
 * @param {Object} props.data - {
 *   type: 'win'|'lose', gainedLife, livesBefore, livesAfter,
 *   levelNumber, totalLevels, stats, timeMs
 * }
 * @param {Function} props.onContinue
 */
export const CampaignInterstitial = ({ data, onContinue }) => {
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

  const isWin = type === "win";
  const accuracy =
    stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;

  // Hearts: show the steady hearts plus the one that is changing (animated).
  const steady = Math.min(isWin && gainedLife ? livesBefore : livesAfter, 9);
  const showDelta = isWin ? gainedLife : true; // a life is always lost on death

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <style>{`
        @keyframes campaign-life-gain {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes campaign-life-loss {
          0% { transform: scale(1) rotate(0); opacity: 1; }
          30% { transform: scale(1.3) rotate(-12deg); opacity: 1; }
          100% { transform: scale(0.4) rotate(18deg); opacity: 0; }
        }
        .campaign-life-gain { animation: campaign-life-gain 0.7s ease-out both; }
        .campaign-life-loss { animation: campaign-life-loss 0.9s ease-in both 0.2s; }
      `}</style>

      <div className="bg-base-100 rounded-2xl p-8 w-96 max-w-[90%] flex flex-col items-center gap-4 border-4 border-base-300">
        {isWin ? (
          <CheckCircle2 className="w-14 h-14 text-success" />
        ) : (
          <Skull className="w-14 h-14 text-error" />
        )}

        <div className="text-center -mt-1">
          <h2 className="text-2xl font-extrabold">
            {isWin ? "Level Cleared!" : "You Died"}
          </h2>
          <p className="text-base-content/50 text-sm">
            Level {levelNumber} of {totalLevels}
          </p>
        </div>

        {/* Lives row with the changing heart animated */}
        <div className="flex items-center gap-1 h-10">
          {Array.from({ length: steady }).map((_, i) => (
            <Heart key={i} className="w-7 h-7 fill-error text-error" />
          ))}
          {showDelta &&
            (isWin ? (
              <Heart className="w-7 h-7 fill-success text-success campaign-life-gain" />
            ) : (
              <HeartCrack className="w-7 h-7 fill-error text-error campaign-life-loss" />
            ))}
        </div>
        <p
          className={`-mt-2 text-sm font-bold ${
            isWin && gainedLife
              ? "text-success"
              : isWin
                ? "text-base-content/50"
                : "text-error"
          }`}
        >
          {isWin && gainedLife
            ? "+1 life!"
            : isWin
              ? `${livesAfter} lives left`
              : `-1 life · ${livesAfter} left`}
        </p>

        {/* Level stats */}
        <div className="w-full grid grid-cols-2 gap-2">
          <Stat icon={<Clock className="w-4 h-4 text-info" />} label="Time" value={formatTime(timeMs)} />
          <Stat icon={<Skull className="w-4 h-4 text-primary" />} label="Kills" value={stats.kills || 0} />
          <Stat icon={<Target className="w-4 h-4 text-success" />} label="Accuracy" value={`${accuracy}%`} />
          <Stat icon={<Crosshair className="w-4 h-4 text-warning" />} label="Shots" value={stats.shots || 0} />
          {(stats.blocksDestroyed || 0) > 0 && (
            <Stat icon={<Hammer className="w-4 h-4 text-base-content/70" />} label="Blocks" value={stats.blocksDestroyed} />
          )}
        </div>

        <button className="btn btn-primary w-full gap-2 mt-2" onClick={onContinue} autoFocus>
          {isWin ? "Next Level" : "Try Again"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-base-content/70">
        {icon}
        {label}
      </span>
      <span className="font-bold text-sm">{value}</span>
    </div>
  );
}
