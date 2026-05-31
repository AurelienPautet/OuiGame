import { Star, Lock } from "lucide-react";
import { extractBotCounts, getBotColor } from "../../utils/levelUtils";
import { TankAvatar } from "./primitives";
import { cn } from "../../lib/cn";

// Format milliseconds to readable time (MM:SS or HH:MM:SS)
function formatTime(ms: number | null): string | null {
  if (!ms) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface LevelCardProps {
  levelId: number;
  levelName: string;
  levelJson?: number[] | null;
  // `level_rating` is an un-coerced Postgres aggregate (string when present, 0 otherwise).
  rating?: string | number;
  thumbnailSrc?: string;
  onClick?: () => void;
  selected?: boolean;
  locked?: boolean;
  author?: string;
  isSolo?: boolean;
  soloTimesPlayed?: number;
  soloSuccessRate?: number;
  soloBestTimeMs?: number | null;
}

/** Arcade level preview card — thumbnail, title, rating, bot spawns, solo stats. */
export function LevelCard({
  levelId,
  levelName,
  levelJson,
  rating = 0,
  thumbnailSrc,
  onClick,
  selected = false,
  locked = false,
  author,
  isSolo = false,
  soloTimesPlayed = 0,
  soloSuccessRate = 0,
  soloBestTimeMs = null,
}: LevelCardProps) {
  const botCounts = extractBotCounts(levelJson);
  const ratingValue = Number(rating) || 0;
  const bestTimeFormatted = formatTime(soloBestTimeMs);

  return (
    <div
      className={cn(
        "relative flex gap-4 p-3 rounded-xl cursor-pointer transition-all duration-150 bg-white border-[3px] shadow-[0_4px_0_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
        selected ? "border-blue ring-3 ring-blue/30" : "border-ink",
        locked && "opacity-80"
      )}
      onClick={locked ? undefined : onClick}
    >
      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/40 rounded-xl text-center">
          <span className="text-white text-lg font-bold flex items-center gap-2">
            <Lock size={18} /> Level {levelId} Locked
          </span>
          <p className="text-white/80 text-sm">Complete previous levels</p>
        </div>
      )}

      <div className={cn("shrink-0", locked && "blur-sm")}>
        <img
          src={thumbnailSrc || "ressources/image/minia/test.png"}
          alt={`Level ${levelId} preview`}
          loading="lazy"
          width={128}
          height={96}
          className="w-32 h-24 object-cover rounded-lg border-[3px] border-ink"
        />
      </div>

      <div
        className={cn(
          "flex-1 flex flex-col justify-between min-w-0",
          locked && "blur-sm"
        )}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-ink truncate">
              <span className="text-ink-soft">lvl {levelId}:</span> {levelName}
            </h3>
            <span className="text-xs font-semibold text-blue-d truncate">
              by {author || "Unknown"}
            </span>
          </div>
          <div className="flex gap-0.5 shrink-0">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={15}
                className={
                  i < ratingValue ? "fill-yellow text-yellow-d" : "text-ink/20"
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(botCounts).map(([botType, count]) => (
            <BotBadge key={botType} botType={Number(botType)} count={count} />
          ))}
        </div>

        {isSolo && soloTimesPlayed > 0 && (
          <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-ink-soft flex-wrap">
            <span className="bg-field border-2 border-ink/15 rounded-md px-1.5 py-0.5">
              {soloTimesPlayed} plays
            </span>
            <span
              className={cn(
                "border-2 border-ink/15 rounded-md px-1.5 py-0.5",
                soloSuccessRate >= 50
                  ? "bg-green/15 text-green-d"
                  : "bg-red/15 text-red-d"
              )}
            >
              {soloSuccessRate}% win
            </span>
            {bestTimeFormatted && (
              <span className="bg-field border-2 border-ink/15 rounded-md px-1.5 py-0.5">
                best {bestTimeFormatted}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface BotBadgeProps {
  botType: number;
  count: number;
}

function BotBadge({ botType, count }: BotBadgeProps) {
  const color = getBotColor(botType);
  return (
    <div className="flex items-center gap-1 bg-field border-2 border-ink rounded-lg px-1.5 py-0.5">
      <span className="text-xs font-bold text-ink">{count}×</span>
      <TankAvatar bodyColor={color} turretColor={color} size={20} />
    </div>
  );
}
