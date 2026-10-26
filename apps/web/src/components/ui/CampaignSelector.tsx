import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, RotateCcw, Layers } from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { useCampaigns, useMyCampaigns } from "../../hooks/api";
import { Input, Button, Select, Chip } from "./primitives";
import { hexToDataUrl } from "../../utils/levelUtils";
import { cn } from "../../lib/cn";
import type { CampaignDifficulty } from "@ouigame/shared/api";

interface CampaignSelectorProps {
  mode?: "play" | "my";
  onSelect?: (campaignId: number) => void;
  onPlay?: (campaignId: number) => void;
  onEdit?: (campaignId: number) => void;
  onDelete?: (campaignId: number) => void;
  onCreate?: () => void;
}

const difficulties: CampaignDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "unknown",
];
const difficultyRank = { easy: 0, medium: 1, hard: 2, expert: 3, unknown: 4 };

export function CampaignSelector({
  mode = "play",
  onSelect,
  onPlay,
  onEdit,
  onDelete,
  onCreate,
}: CampaignSelectorProps) {
  const { t } = useTranslation();
  const isMy = mode === "my";
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [minRating, setMinRating] = useState("all");
  const [sort, setSort] = useState("newest");
  const listRef = useRef<HTMLDivElement>(null);
  // Fetch once. Server name filtering would discard author/description matches.
  // Both hooks run unconditionally; only the active mode's query is enabled.
  const publicQuery = useCampaigns({}, !isMy);
  const myQuery = useMyCampaigns({}, isMy);
  const query = isMy ? myQuery : publicQuery;
  const allCampaigns = query.data;
  const campaigns = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = (allCampaigns ?? []).filter((c) => {
      if (
        term &&
        ![
          c.campaign_name,
          c.campaign_description,
          c.campaign_creator_name,
        ].some((text) => text?.toLocaleLowerCase().includes(term))
      )
        return false;
      if (difficulty !== "all" && (c.difficulty ?? "unknown") !== difficulty)
        return false;
      if (
        minRating !== "all" &&
        (!(c.rating_count > 0) || Number(c.rating) < Number(minRating))
      )
        return false;
      if (status === "completed" && !c.completed) return false;
      if (
        status === "in_progress" &&
        (c.completed || c.completion_percent <= 0)
      )
        return false;
      if (status === "not_started" && (c.completed || c.completion_percent > 0))
        return false;
      return true;
    });
    return filtered.sort((a, b) => {
      let result = 0;
      switch (sort) {
        case "rating":
          result =
            Number(b.rating) - Number(a.rating) ||
            b.rating_count - a.rating_count;
          break;
        case "easiest":
        case "hardest": {
          // Unknown difficulty always belongs at the end, in either direction.
          const ar = difficultyRank[a.difficulty ?? "unknown"];
          const br = difficultyRank[b.difficulty ?? "unknown"];
          result =
            ar === 4 || br === 4
              ? ar - br
              : (ar - br) * (sort === "hardest" ? -1 : 1);
          break;
        }
        case "popularity":
          result = b.times_played - a.times_played;
          break;
        case "name":
          result = a.campaign_name.localeCompare(b.campaign_name);
          break;
        default:
          result = b.campaign_id - a.campaign_id;
      }
      return result || b.campaign_id - a.campaign_id;
    });
  }, [allCampaigns, search, difficulty, status, minRating, sort]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [search, difficulty, status, minRating, sort]);

  const isFiltered =
    !!search.trim() ||
    difficulty !== "all" ||
    status !== "all" ||
    minRating !== "all";
  const reset = () => {
    setSearch("");
    setDifficulty("all");
    setStatus("all");
    setMinRating("all");
  };
  const options = (items: string[]) =>
    items.map((value) => ({ value, label: t(`campaignSelector.${value}`) }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              size={19}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <Input
              aria-label={t("campaignSelector.searchPlaceholder")}
              className="pl-11"
              placeholder={t("campaignSelector.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isMy && onCreate && (
            <Button
              variant="green"
              onClick={onCreate}
              className="shrink-0 gap-1.5"
            >
              <Plus size={18} />
              {t("campaignSelector.newCampaign")}
            </Button>
          )}
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-ink-soft">
            {t("campaignSelector.filterDifficulty")}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {["all", ...difficulties].map((value) => (
              <Chip
                key={value}
                active={difficulty === value}
                onClick={() => setDifficulty(value)}
                className="min-h-9 px-3 py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30"
              >
                {t(
                  `campaignSelector.${value === "all" ? "allDifficulties" : value}`
                )}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            {
              label: "filterStatus",
              value: status,
              change: setStatus,
              items: options([
                "allStatus",
                "notStarted",
                "inProgress",
                "completed",
              ]).map((o, i) => ({
                ...o,
                value: ["all", "not_started", "in_progress", "completed"][i]!,
              })),
            },
            {
              label: "filterRating",
              value: minRating,
              change: setMinRating,
              items: [
                { value: "all", label: t("campaignSelector.anyRating") },
                {
                  value: "4",
                  label: t("campaignSelector.ratingAtLeast", { rating: 4 }),
                },
                {
                  value: "3",
                  label: t("campaignSelector.ratingAtLeast", { rating: 3 }),
                },
              ],
            },
            {
              label: "sortBy",
              value: sort,
              change: setSort,
              items: options([
                "newest",
                "rating",
                "easiest",
                "hardest",
                "popularity",
                "name",
              ]),
            },
          ].map((control) => (
            <label
              key={control.label}
              className={cn(
                "flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink-soft",
                control.label === "sortBy" && "col-span-2 sm:col-span-1"
              )}
            >
              <span>{t(`campaignSelector.${control.label}`)}</span>
              <Select
                aria-label={t(`campaignSelector.${control.label}`)}
                value={control.value}
                onValueChange={control.change}
                options={control.items}
                className="w-full min-h-10 text-sm px-3 py-2"
              />
            </label>
          ))}
        </div>
        <details className="text-xs text-ink-soft leading-relaxed">
          <summary className="cursor-pointer w-fit">
            {t("campaignSelector.difficultyAbout")}
          </summary>
          <p className="mt-1 max-w-prose">
            {t("campaignSelector.difficultyHelp")}
          </p>
        </details>
      </div>
      <div className="flex min-h-7 shrink-0 items-center justify-between gap-2 border-t-2 border-ink/10 pt-3 text-sm text-ink-soft">
        <span role="status" aria-live="polite">
          {!query.isLoading &&
            !query.isError &&
            t("campaignSelector.showingFiltered", {
              filtered: campaigns.length,
              total: allCampaigns?.length ?? 0,
            })}
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-blue-d font-semibold cursor-pointer hover:underline"
          >
            <RotateCcw size={14} />
            {t("campaignSelector.clearFilters")}
          </button>
        )}
      </div>
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-2 pt-1 space-y-3"
      >
        {query.isLoading ? (
          <p className="py-12 text-center text-ink-soft">
            {t("campaignSelector.loadingCampaigns")}
          </p>
        ) : query.isError ? (
          <div className="py-12 text-center space-y-3">
            <p>{t("campaignSelector.loadError")}</p>
            <Button size="sm" onClick={() => query.refetch()}>
              {t("campaignSelector.retry")}
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center gap-3 text-ink-soft">
            <Layers size={36} aria-hidden="true" />
            <p>
              {t(
                isFiltered
                  ? "campaignSelector.noMatchingCampaigns"
                  : isMy
                    ? "campaignSelector.noCampaignsMine"
                    : "campaignSelector.noCampaigns"
              )}
            </p>
            {isFiltered && (
              <Button variant="blue" size="sm" onClick={reset}>
                {t("campaignSelector.resetFilters")}
              </Button>
            )}
          </div>
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.campaign_id}
              campaignId={c.campaign_id}
              name={c.campaign_name}
              {...(c.preview_img
                ? { thumbnailSrc: hexToDataUrl(c.preview_img) }
                : {})}
              description={c.campaign_description}
              levelCount={c.level_count}
              completionPercent={c.completion_percent}
              completed={c.completed}
              author={c.campaign_creator_name}
              rating={c.rating}
              ratingCount={c.rating_count}
              difficulty={c.difficulty}
              timesPlayed={c.times_played}
              clearRate={c.clear_rate}
              {...(!isMy
                ? { onClick: () => onSelect?.(c.campaign_id) }
                : {
                    ...(onPlay ? { onPlay } : {}),
                    ...(onEdit ? { onEdit } : {}),
                    ...(onDelete ? { onDelete } : {}),
                  })}
            />
          ))
        )}
      </div>
    </div>
  );
}
