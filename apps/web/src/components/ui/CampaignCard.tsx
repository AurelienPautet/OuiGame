import {
  Layers,
  CheckCircle2,
  Play,
  Pencil,
  Trash2,
  Trophy,
  Shield,
  Target,
  Flame,
  Skull,
  Swords,
  Star,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Button, Card, StarRating } from "./primitives";
import { springs } from "../../lib/motion";
import { cn } from "../../lib/cn";
import type { CampaignDifficulty } from "@ouigame/shared/api";

const DIFFICULTY_CONFIG = {
  easy: {
    labelKey: "campaignCard.easy",
    badgeClass:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-500",
    icon: Shield,
  },
  medium: {
    labelKey: "campaignCard.medium",
    badgeClass:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dotClass: "bg-sky-500",
    icon: Target,
  },
  hard: {
    labelKey: "campaignCard.hard",
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-500",
    icon: Flame,
  },
  expert: {
    labelKey: "campaignCard.expert",
    badgeClass:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dotClass: "bg-rose-500",
    icon: Skull,
  },
} as const;

/**
 * CampaignCard - Displays a rich campaign preview with difficulty badge,
 * star rating, enemy/run statistics, and completion progress.
 */
export interface CampaignCardProps {
  campaignId: number;
  name: string;
  description?: string;
  levelCount?: number;
  completionPercent?: number; // 0-100
  completed?: boolean; // finished a full run at least once
  author?: string;
  rating?: number | string;
  ratingCount?: number;
  difficulty?: CampaignDifficulty;
  difficultyScore?: number;
  timesPlayed?: number;
  clearRate?: number;
  enemyCount?: number;
  onClick?: () => void;
  onPlay?: (campaignId: number) => void; // shown as Play button when provided
  onEdit?: (campaignId: number) => void; // shown as Edit button when provided
  onDelete?: (campaignId: number) => void; // shown as Delete button when provided
}

export function CampaignCard({
  campaignId,
  name,
  description,
  levelCount = 0,
  completionPercent = 0,
  completed = false,
  author,
  rating = 0,
  ratingCount = 0,
  difficulty = "medium",
  difficultyScore = 1,
  timesPlayed = 0,
  clearRate = 0,
  enemyCount = 0,
  onClick,
  onPlay,
  onEdit,
  onDelete,
}: CampaignCardProps) {
  const { t } = useTranslation();
  const showActions = !!(onPlay || onEdit || onDelete);
  const pct = Math.max(0, Math.min(100, completionPercent || 0));
  const ratingValue = Number(rating) || 0;

  const diffConfig =
    DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG] ||
    DIFFICULTY_CONFIG.medium;
  const DiffIcon = diffConfig.icon;

  return (
    <Card
      className={cn(
        "group flex flex-col sm:flex-row gap-4 p-3.5 relative transition-all duration-200",
        completed ? "hover:border-green" : "hover:border-blue"
      )}
      onClick={onClick}
    >
      {/* Left visual icon badge */}
      <div className="shrink-0 w-full sm:w-28 h-24 sm:h-28 rounded-xl border-[3px] border-ink bg-field flex flex-col items-center justify-center relative overflow-hidden transition-transform duration-300 ease-out group-hover:scale-[1.03] group-hover:-rotate-1">
        {completed ? (
          <Trophy className="w-12 h-12 text-yellow-d drop-shadow-sm" />
        ) : (
          <Layers className="w-12 h-12 text-blue-d" />
        )}
        <div className="absolute bottom-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-canvas border border-ink/20 text-ink-soft">
          {t("campaignCard.levels", { count: levelCount })}
        </div>
      </div>

      {/* Main content body */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Header row: Title + Rating */}
          <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex flex-col min-w-0 pr-2">
              <h3 className="text-lg font-bold text-ink truncate leading-tight group-hover:text-blue-d transition-colors">
                {name}
              </h3>
              <span className="text-xs font-semibold text-blue-d truncate mt-0.5">
                {t("common.by", { name: author || t("common.unknown") })}
              </span>
            </div>

            {/* Rating pill */}
            <div className="shrink-0">
              {ratingValue > 0 ? (
                <div
                  className="flex items-center gap-1.5 bg-field border-2 border-ink/15 rounded-lg px-2 py-1 shadow-2xs"
                  aria-label={`Rating: ${ratingValue.toFixed(1)} out of 5 stars`}
                >
                  <StarRating
                    value={ratingValue}
                    size={14}
                    className="gap-0.5"
                  />
                  <span className="text-xs font-black text-ink">
                    {ratingValue.toFixed(1)}
                  </span>
                  {ratingCount > 0 && (
                    <span className="text-[11px] font-semibold text-ink-soft">
                      ({ratingCount})
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-field/60 border-2 border-ink/10 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft">
                  <Star size={13} className="text-ink-soft/40" />
                  <span>{t("campaignCard.unrated")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Badges cluster: Difficulty, Enemy count, Plays, Clear rate */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Difficulty Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-bold border-2 rounded-md px-2 py-0.5 shadow-2xs",
                diffConfig.badgeClass
              )}
            >
              <DiffIcon size={13} className="shrink-0" />
              <span>{t(diffConfig.labelKey)}</span>
              {difficultyScore > 0 && (
                <span className="text-[10px] font-semibold opacity-75">
                  · {difficultyScore}/10
                </span>
              )}
            </span>

            {/* Total Enemy bots badge (if any) */}
            {enemyCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-field border-2 border-ink/15 rounded-md px-2 py-0.5 text-xs font-semibold text-ink-soft">
                <Swords size={12} className="shrink-0 text-red-d" />
                <span>{t("campaignCard.bots", { count: enemyCount })}</span>
              </span>
            )}

            {/* Run statistics: Times played and Clear rate */}
            {timesPlayed > 0 && (
              <>
                <span className="bg-field border-2 border-ink/15 rounded-md px-2 py-0.5 text-xs font-semibold text-ink-soft">
                  {t("campaignCard.plays", { count: timesPlayed })}
                </span>
                <span
                  className={cn(
                    "border-2 border-ink/15 rounded-md px-2 py-0.5 text-xs font-semibold",
                    clearRate >= 50
                      ? "bg-green/15 text-green-d"
                      : "bg-red/15 text-red-d"
                  )}
                >
                  {t("campaignCard.winShare", { rate: clearRate })}
                </span>
              </>
            )}

            {/* Completed badge */}
            {completed && (
              <span className="inline-flex items-center gap-1 bg-green text-white text-xs font-bold border-2 border-ink rounded-full px-2 py-0.5 ml-auto">
                <CheckCircle2 size={12} strokeWidth={3} />
                {t("campaignCard.done")}
              </span>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-ink-soft line-clamp-2 mt-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs font-semibold text-ink-soft mb-1">
            <span>{t("campaignCard.progress")}</span>
            <span className="font-bold text-ink">{pct}%</span>
          </div>
          <div className="h-3 rounded-full border-2 border-ink bg-field overflow-hidden">
            <motion.div
              className={cn(
                "h-full origin-left",
                completed ? "bg-green" : "bg-blue"
              )}
              style={{ width: `${pct}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ ...springs.soft, delay: 0.1 }}
            />
          </div>
        </div>
      </div>

      {/* Owner actions (Play, Edit, Delete) */}
      {showActions && (
        <div className="flex sm:flex-col justify-end gap-1.5 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-ink/10">
          {onPlay && (
            <Button
              variant="green"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(campaignId);
              }}
              className="gap-1"
            >
              <Play size={14} /> {t("campaignCard.play")}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="blue"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(campaignId);
              }}
              className="gap-1"
            >
              <Pencil size={14} /> {t("campaignCard.edit")}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(campaignId);
              }}
              className="gap-1"
            >
              <Trash2 size={14} /> {t("campaignCard.delete")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
