import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Layers } from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { useCampaigns, useMyCampaigns } from "../../hooks/api";
import { Input, Button, Chip } from "./primitives";
import { hexToDataUrl } from "../../utils/levelUtils";
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
      return true;
    });
    // Newest first: campaigns have no creation timestamp, so the id is the order.
    return filtered.sort((a, b) => b.campaign_id - a.campaign_id);
  }, [allCampaigns, search, difficulty]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [search, difficulty]);

  const isFiltered = !!search.trim() || difficulty !== "all";
  const reset = () => {
    setSearch("");
    setDifficulty("all");
  };

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
