import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Star, Check, ChevronRight, Play, Pencil, Trash2 } from "lucide-react";
import { Card, Button, TankAvatar } from "./primitives";
import { cn } from "../../lib/cn";
import type { CampaignDifficulty } from "@ouigame/shared/api";

const difficultyColors = {
  easy: "bg-green",
  medium: "bg-blue",
  hard: "bg-orange",
  expert: "bg-red",
  unknown: "bg-field",
};

export interface CampaignCardProps {
  campaignId: number;
  name: string;
  description?: string;
  levelCount?: number;
  completionPercent?: number;
  completed?: boolean;
  author?: string;
  rating?: number | string;
  ratingCount?: number;
  difficulty?: CampaignDifficulty;
  timesPlayed?: number;
  clearRate?: number;
  onClick?: () => void;
  onPlay?: (campaignId: number) => void;
  onEdit?: (campaignId: number) => void;
  onDelete?: (campaignId: number) => void;
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
  difficulty = "unknown",
  timesPlayed = 0,
  clearRate = 0,
  onClick,
  onPlay,
  onEdit,
  onDelete,
}: CampaignCardProps) {
  const { t } = useTranslation();
  const pct = Math.max(0, Math.min(100, completionPercent));
  const showActions = !!(onPlay || onEdit || onDelete);
  return (
    <Card
      className={cn(
        "group p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30",
        !onClick && "cursor-default"
      )}
      {...(onClick
        ? {
            onClick,
            role: "button",
            tabIndex: 0,
            "aria-label": name,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <div className="flex gap-3 sm:gap-4">
        <div
          aria-hidden="true"
          className="hidden sm:flex w-20 h-20 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-field/40 graph-paper"
        >
          <TankAvatar bodyColor="blue" size={66} angle={-Math.PI / 4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug text-ink break-words line-clamp-2">
                {name}
              </h3>
              <p className="text-xs text-ink-soft mt-0.5">
                {t("common.by", { name: author || t("common.unknown") })}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                {t("campaignCard.levels", { count: levelCount })}
              </p>
            </div>
            {onClick && (
              <ChevronRight
                aria-hidden="true"
                size={20}
                className="shrink-0 mt-1 text-ink-soft group-hover:text-blue-d"
              />
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft line-clamp-2">
              {description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-ink">
            <span
              className="inline-flex items-center gap-1.5"
              title={t("campaignSelector.difficultyHelp")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full border border-ink",
                  difficultyColors[difficulty]
                )}
              />
              {t(`campaignCard.${difficulty}`)}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={t("campaignCard.ratingHelp")}
            >
              <Star
                size={14}
                aria-hidden="true"
                className={
                  ratingCount > 0 ? "fill-yellow text-ink" : "text-ink-soft"
                }
              />
              {ratingCount > 0 ? (
                <>
                  {Number(rating).toFixed(1)}
                  <span className="text-ink-soft font-normal">
                    ({ratingCount})
                  </span>
                </>
              ) : (
                <span className="font-normal text-ink-soft">
                  {t("campaignCard.unrated")}
                </span>
              )}
            </span>
            {timesPlayed > 0 && (
              <span className="font-normal text-ink-soft">
                {t("campaignCard.plays", { count: timesPlayed })}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                {t("campaignCard.winShare", { rate: clearRate })}
              </span>
            )}
            {completed && (
              <span className="inline-flex items-center gap-1 text-green-d">
                <Check size={14} aria-hidden="true" />
                {t("campaignCard.done")}
              </span>
            )}
          </div>
          {!showActions && pct > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={t("campaignCard.progress")}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 flex-1 overflow-hidden rounded-full border border-ink bg-field/50"
              >
                <div
                  className={cn("h-full", completed ? "bg-green" : "bg-blue")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-ink-soft">{pct}%</span>
            </div>
          )}
        </div>
      </div>
      {showActions && (
        <div
          className="mt-3 flex flex-wrap justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {onPlay && (
            <Button
              size="sm"
              variant="blue"
              onClick={() => onPlay(campaignId)}
              className="gap-1.5"
            >
              <Play size={14} />
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
      )}
    </Card>
  );
}
export const MemoizedCampaignCard = memo(CampaignCard);
