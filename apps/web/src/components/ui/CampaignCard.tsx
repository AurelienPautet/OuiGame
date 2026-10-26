import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Check, Play, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  Button,
  StarRating,
  ListCardPreview,
  ListCardStat,
} from "./primitives";
import { cn } from "../../lib/cn";
import type { CampaignDifficulty } from "@ouigame/shared/api";

const difficultyTones = {
  easy: "success",
  medium: "info",
  hard: "warning",
  expert: "danger",
  unknown: "neutral",
} as const;

export interface CampaignCardProps {
  campaignId: number;
  name: string;
  description?: string;
  thumbnailSrc?: string;
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
  thumbnailSrc,
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
        "group p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30",
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
      <div className="grid grid-cols-[80px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)] gap-x-4 gap-y-2">
        <ListCardPreview
          {...(thumbnailSrc ? { src: thumbnailSrc } : {})}
          alt={name}
          fallback={<Layers className="size-10 text-blue-d" />}
          className="w-20 h-16 sm:w-32 sm:h-24 sm:row-span-5"
        />
        <div className="contents">
          <div className="col-start-2 flex flex-wrap justify-between items-start gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1 basis-40">
              <h3 className="text-lg font-bold text-ink leading-snug break-words line-clamp-2">
                {name}
              </h3>
              <p className="text-xs font-semibold text-blue-d mt-0.5">
                {t("common.by", { name: author || t("common.unknown") })}
              </p>
            </div>
            <div className="shrink-0" title={t("campaignCard.ratingHelp")}>
              <div aria-hidden="true">
                <StarRating
                  value={ratingCount > 0 ? Number(rating) : 0}
                  size={15}
                  className="gap-0.5"
                />
              </div>
              <p className="text-xs text-ink-soft mt-0.5 sm:text-right">
                {ratingCount > 0 ? (
                  <>
                    <span className="font-semibold">
                      {Number(rating).toFixed(1)}
                    </span>{" "}
                    <span>({ratingCount})</span>
                  </>
                ) : (
                  t("campaignCard.unrated")
                )}
              </p>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:col-start-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 bg-field border-2 border-ink rounded-lg px-1.5 py-0.5 text-xs font-bold text-ink">
              <Layers size={14} aria-hidden="true" />
              {t("campaignCard.levels", { count: levelCount })}
            </span>
            <ListCardStat
              tone={difficultyTones[difficulty]}
              title={t("campaignSelector.difficultyHelp")}
            >
              {t(`campaignCard.${difficulty}`)}
            </ListCardStat>
            {completed && (
              <ListCardStat tone="success">
                <Check size={14} aria-hidden="true" />
                {t("campaignCard.done")}
              </ListCardStat>
            )}
          </div>
          {description && (
            <p className="col-span-2 sm:col-span-1 sm:col-start-2 text-sm leading-relaxed text-ink-soft line-clamp-2">
              {description}
            </p>
          )}
          {timesPlayed > 0 && (
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 flex flex-wrap items-center gap-2">
              <ListCardStat>
                {t("campaignCard.plays", { count: timesPlayed })}
              </ListCardStat>
              <ListCardStat tone={clearRate >= 50 ? "success" : "danger"}>
                {t("campaignCard.winShare", { rate: clearRate })}
              </ListCardStat>
            </div>
          )}
          {!showActions && pct > 0 && (
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 mt-1 flex items-center gap-3">
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
