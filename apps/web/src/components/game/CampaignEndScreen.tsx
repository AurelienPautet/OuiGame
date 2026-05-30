import type { ReactNode } from "react";
import {
  Trophy,
  Skull,
  Clock,
  Layers,
  Heart,
  RotateCcw,
  LogOut,
} from "lucide-react";

/**
 * Terminal result of a campaign run, computed by GameContext's run state
 * machine (campaignAdvance / campaignLoseLife) and stored on
 * `campaignRunResult`.
 */
export interface CampaignRunResult {
  completed: boolean;
  levelsCleared: number;
  livesLeft: number;
  timeMs: number;
}

function formatTime(ms: number): string {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * CampaignEndScreen - shown when a campaign run ends (completed or out of lives).
 */
interface CampaignEndScreenProps {
  result: CampaignRunResult | null;
  totalLevels: number;
  /** restart the campaign from level 1 */
  onReplay: () => void;
  onQuit: () => void;
}

export const CampaignEndScreen = ({
  result,
  totalLevels,
  onReplay,
  onQuit,
}: CampaignEndScreenProps) => {
  if (!result) return null;
  const { completed, levelsCleared, livesLeft, timeMs } = result;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-base-100 rounded-2xl p-8 w-96 max-w-[90%] flex flex-col items-center gap-4 border-4 border-base-300">
        {completed ? (
          <Trophy className="w-16 h-16 text-warning" />
        ) : (
          <Skull className="w-16 h-16 text-error" />
        )}

        <h2 className="text-3xl font-extrabold text-center">
          {completed ? "Campaign Complete!" : "Run Over"}
        </h2>
        <p className="text-base-content/60 text-center -mt-2">
          {completed
            ? "You cleared every level. Nice work!"
            : "You ran out of lives."}
        </p>

        <div className="w-full flex flex-col gap-2 mt-2">
          <Stat
            icon={<Layers className="w-5 h-5 text-primary" />}
            label="Levels cleared"
            value={`${levelsCleared} / ${totalLevels}`}
          />
          <Stat
            icon={<Heart className="w-5 h-5 text-error" />}
            label="Lives left"
            value={livesLeft}
          />
          <Stat
            icon={<Clock className="w-5 h-5 text-info" />}
            label="Total time"
            value={formatTime(timeMs)}
          />
        </div>

        <div className="flex gap-3 mt-4 w-full">
          <button className="btn btn-primary flex-1 gap-2" onClick={onReplay}>
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
          <button className="btn btn-ghost flex-1 gap-2" onClick={onQuit}>
            <LogOut className="w-4 h-4" />
            Quit
          </button>
        </div>
      </div>
    </div>
  );
};

interface StatProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex items-center justify-between bg-base-200 rounded-lg px-4 py-2">
      <span className="flex items-center gap-2 text-base-content/70">
        {icon}
        {label}
      </span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
