import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  Layers,
  Trophy,
  Play,
  Pencil,
  Trash2,
  Shield,
  Crosshair,
  Flame,
  Skull,
  Swords,
  Gamepad2,
  TrendingUp,
  Star,
  CheckCircle2,
} from "lucide-react";
import { Card, Button, StarRating } from "./primitives";
import { cn } from "../../lib/cn";
import { springs } from "../../lib/motion";
import type { CampaignDifficulty } from "@ouigame/shared/api";

const DIFFICULTY_CONFIG = {
  easy: {
    icon: Shield,
    badgeClass:
      "bg-green text-white border-2 border-ink shadow-[0_2px_0_rgba(0,0,0,0.18)]",
    labelKey: "campaignCard.easy",
  },
  medium: {
    icon: Crosshair,
    badgeClass:
      "bg-blue text-white border-2 border-ink shadow-[0_2px_0_rgba(0,0,0,0.18)]",
    labelKey: "campaignCard.medium",
  },
  hard: {
    icon: Flame,
    badgeClass:
      "bg-[#e28743] text-white border-2 border-ink shadow-[0_2px_0_rgba(0,0,0,0.18)]",
    labelKey: "campaignCard.hard",
  },
  expert: {
    icon: Skull,
    badgeClass:
      "bg-red text-white border-2 border-ink shadow-[0_2px_0_rgba(0,0,0,0.18)]",
    labelKey: "campaignCard.expert",
  },
};

/**
 * CampaignCard - Authentic OuiTank arcade card showing campaign summary,
 * difficulty badge, star rating, bot threat count, run statistics, and progress.
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
        "group flex flex-col sm:flex-row gap-4 p-3.5 relative transition-all duration-200 border-[3px] border-ink",
        completed ? "hover:border-green" : "hover:border-blue"
      )}
      onClick={onClick}
    >
      {/* Left visual icon badge */}
      <div className="shrink-0 w-full sm:w-28 h-24 sm:h-28 rounded-xl border-[3px] border-ink bg-field flex flex-col items-center justify-center relative overflow-hidden transition-transform duration-300 ease-out group-hover:scale-[1.03] group-hover:-rotate-1">
        {completed ? (
          <Trophy
            className="w-12 h-12 text-yellow-d drop-shadow-sm"
            strokeWidth={2.5}
          />
        ) : (
          <Layers className="w-12 h-12 text-blue-d" strokeWidth={2.5} />
        )}
        <div className="absolute bottom-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border-2 border-ink text-ink shadow-[0_1px_0_rgba(0,0,0,0.15)]">
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
                  className="flex items-center gap-1.5 bg-field border-2 border-ink rounded-lg px-2 py-1 shadow-[0_2px_0_rgba(0,0,0,0.15)]"
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
                <div className="flex items-center gap-1 bg-field border-2 border-ink/30 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft">
                  <Star
                    size={13}
                    strokeWidth={2.5}
                    className="text-ink-soft/40"
                  />
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
                "inline-flex items-center gap-1 text-xs font-bold uppercase rounded-md px-2 py-0.5 tracking-wide",
                diffConfig.badgeClass
              )}
            >
              <DiffIcon size={13} strokeWidth={2.5} className="shrink-0" />
              <span>{t(diffConfig.labelKey)}</span>
              {difficultyScore > 0 && (
                <span className="text-[10px] font-black opacity-90">
                  {difficultyScore}/10
                </span>
              )}
            </span>

            {/* Total Enemy bots badge (if any) */}
            {enemyCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-field border-2 border-ink rounded-md px-2 py-0.5 text-xs font-bold text-ink shadow-[0_1px_0_rgba(0,0,0,0.12)]">
                <Swords
                  size={13}
                  strokeWidth={2.5}
                  className="shrink-0 text-red-d"
                />
                <span>{t("campaignCard.bots", { count: enemyCount })}</span>
              </span>
            )}

            {/* Run statistics: Times played and Clear rate */}
            {timesPlayed > 0 && (
              <span className="inline-flex items-center gap-1 bg-field border-2 border-ink rounded-md px-2 py-0.5 text-xs font-bold text-ink shadow-[0_1px_0_rgba(0,0,0,0.12)]">
                <Gamepad2
                  size={13}
                  strokeWidth={2.5}
                  className="shrink-0 text-ink-soft"
                />
                <span>{t("campaignCard.plays", { count: timesPlayed })}</span>
              </span>
            )}

            {clearRate !== undefined && timesPlayed > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 border-2 border-ink rounded-md px-2 py-0.5 text-xs font-bold shadow-[0_1px_0_rgba(0,0,0,0.12)]",
                  clearRate >= 50 ? "bg-green text-white" : "bg-field text-ink"
                )}
              >
                <TrendingUp size={13} strokeWidth={2.5} className="shrink-0" />
                <span>{t("campaignCard.winShare", { rate: clearRate })}</span>
              </span>
            )}

            {/* Completed badge */}
            {completed && (
              <span className="inline-flex items-center gap-1 bg-yellow text-ink border-2 border-ink rounded-md px-2 py-0.5 text-xs font-black shadow-[0_2px_0_rgba(0,0,0,0.18)]">
                <CheckCircle2
                  size={13}
                  strokeWidth={3}
                  className="shrink-0 text-ink"
                />
                <span>{t("campaignCard.done")}</span>
              </span>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-ink-soft line-clamp-2 mt-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Bottom progress bar or action buttons */}
        <div className="mt-3">
          {showActions ? (
            <div
              className="flex items-center justify-end gap-2 pt-2 border-t-2 border-ink/10"
              onClick={(e) => e.stopPropagation()}
            >
              {onPlay && (
                <Button
                  size="sm"
                  variant="blue"
                  onClick={() => onPlay(campaignId)}
                  className="gap-1.5"
                >
                  <Play size={14} className="fill-current" />
                  {t("common.play")}
                </Button>
              )}
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(campaignId)}
                  className="gap-1.5"
                >
                  <Pencil size={14} />
                  {t("common.edit")}
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="red"
                  onClick={() => onDelete(campaignId)}
                  className="gap-1.5"
                >
                  <Trash2 size={14} />
                  {t("common.delete")}
                </Button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-xs font-semibold text-ink-soft mb-1">
                <span>{t("campaignCard.progress")}</span>
                <span className="font-bold text-ink">{pct}%</span>
              </div>
              <div className="h-3 rounded-full border-[2.5px] border-ink bg-field overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full origin-left",
                    completed ? "bg-green" : "bg-blue"
                  )}
                  style={{ width: `${pct}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={springs.gentle}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export const MemoizedCampaignCard = memo(CampaignCard);
