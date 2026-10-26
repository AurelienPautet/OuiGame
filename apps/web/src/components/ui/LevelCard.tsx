import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { extractBotCounts, getBotColor } from "../../utils/levelUtils";
import {
  Card,
  StarRating,
  TankAvatar,
  ListCardPreview,
  ListCardStat,
} from "./primitives";
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
  /** Right-hand action cluster (play/edit/delete) for the owner's list. */
  actions?: React.ReactNode;
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
  actions,
}: LevelCardProps) {
  const { t } = useTranslation();
  const botCounts = extractBotCounts(levelJson);
  const ratingValue = Number(rating) || 0;
  const bestTimeFormatted = formatTime(soloBestTimeMs);

  return (
    <Card
      className={cn(
        "group flex flex-wrap gap-x-4 gap-y-2 p-3",
        selected ? "border-blue ring-3 ring-blue/30" : "border-ink",
        locked && "opacity-80"
      )}
      disabled={locked}
      onClick={onClick}
    >
      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/40 rounded-xl text-center">
          <span className="text-white text-lg font-bold flex items-center gap-2">
            <Lock size={18} /> {t("levelCard.locked", { id: levelId })}
          </span>
          <p className="text-white/80 text-sm">
            {t("levelCard.completePrevious")}
          </p>
        </div>
      )}

      <div className={cn("shrink-0", locked && "blur-sm")}>
        <ListCardPreview
          src={thumbnailSrc || "ressources/image/minia/test.png"}
          alt={`Level ${levelId} preview`}
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
              <span className="text-ink-soft">
                {t("levelCard.lvlPrefix", { id: levelId })}
              </span>{" "}
              {levelName}
            </h3>
            <span className="text-xs font-semibold text-blue-d truncate">
              {t("common.by", { name: author || t("common.unknown") })}
            </span>
          </div>
          <StarRating
            value={ratingValue}
            size={15}
            className="gap-0.5 shrink-0"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(botCounts).map(([botType, count]) => (
            <BotBadge key={botType} botType={Number(botType)} count={count} />
          ))}
        </div>

        {isSolo && soloTimesPlayed > 0 && (
          <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-ink-soft flex-wrap">
            <ListCardStat>
              {t("levelCard.plays", { count: soloTimesPlayed })}
            </ListCardStat>
            <ListCardStat tone={soloSuccessRate >= 50 ? "success" : "danger"}>
              {t("levelCard.winShare", { rate: soloSuccessRate })}
            </ListCardStat>
            {bestTimeFormatted && (
              <ListCardStat>
                {t("levelCard.best", { time: bestTimeFormatted })}
              </ListCardStat>
            )}
          </div>
        )}
      </div>

      {/* Owner actions. On wide cards they sit in a right-hand column; when
          space runs out (narrow/portrait) they wrap onto their own row instead
          of squeezing the title away. */}
      {actions && (
        <div className="flex w-full justify-end gap-1.5 sm:w-auto sm:self-center sm:gap-2">
          {actions}
        </div>
      )}
    </Card>
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
