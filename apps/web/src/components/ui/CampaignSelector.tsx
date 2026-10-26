import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Layers,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { useCampaigns, useMyCampaigns } from "../../hooks/api";
import { storage } from "../../lib/storage";
import { Input, Button, Select, IconButton } from "./primitives";
import type { CampaignDTO } from "@ouigame/shared/api";

interface CampaignSelectorState {
  searchName: string;
  difficulty: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  scrollTop: number;
}

/**
 * CampaignSelector - Interactive campaign browser with search,
 * difficulty filtering, completion status filtering, and sorting.
 * Styled in the OuiTank arcade art style with solid ink outlines and zero emojis.
 */
interface CampaignSelectorProps {
  mode?: "play" | "my";
  onSelect?: (campaignId: number) => void; // play mode
  onPlay?: (campaignId: number) => void; // my mode
  onEdit?: (campaignId: number) => void; // my mode
  onDelete?: (campaignId: number) => void; // my mode
  onCreate?: () => void; // "New Campaign" clicked (my mode)
}

function getDifficultyScore(c: CampaignDTO): number {
  if (c.difficulty_score && c.difficulty_score > 0) {
    return c.difficulty_score;
  }
  switch (c.difficulty) {
    case "easy":
      return 2;
    case "medium":
      return 5;
    case "hard":
      return 7;
    case "expert":
      return 9;
    default:
      return 5;
  }
}

export function CampaignSelector({
  mode = "play",
  onSelect,
  onPlay,
  onEdit,
  onDelete,
  onCreate,
}: CampaignSelectorProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const isMy = mode === "my";

  const savedState = useMemo(() => {
    if (mode !== "play") return null;
    return storage.getCampaignSelectorState<CampaignSelectorState>();
  }, [mode]);

  const [searchName, setSearchName] = useState(savedState?.searchName || "");
  const [difficulty, setDifficulty] = useState<string>(
    savedState?.difficulty || "all"
  );
  const [status, setStatus] = useState<string>(savedState?.status || "all");
  const [sortBy, setSortBy] = useState<string>(savedState?.sortBy || "rating");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    savedState?.sortOrder || "desc"
  );

  // Restore scroll position after mount
  useEffect(() => {
    if (mode === "play" && savedState?.scrollTop && listRef.current) {
      const timer = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = savedState.scrollTop;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, savedState?.scrollTop]);

  // Persist state in play mode
  useEffect(() => {
    if (mode === "play") {
      const state: CampaignSelectorState = {
        searchName,
        difficulty,
        status,
        sortBy,
        sortOrder,
        scrollTop: listRef.current?.scrollTop || 0,
      };
      storage.setCampaignSelectorState(state);
    }
  }, [mode, searchName, difficulty, status, sortBy, sortOrder]);

  const query = isMy
    ? useMyCampaigns({ name: searchName })
    : useCampaigns({ name: searchName });

  const rawCampaigns = query.data || [];
  const isLoading = query.isLoading;

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return rawCampaigns.filter((c) => {
      // Search query filter (matches name, description, or author)
      if (q.length > 0) {
        const matchesName = c.campaign_name.toLowerCase().includes(q);
        const matchesDesc = c.campaign_description?.toLowerCase().includes(q);
        const matchesAuthor = c.campaign_creator_name
          ?.toLowerCase()
          .includes(q);
        if (!matchesName && !matchesDesc && !matchesAuthor) {
          return false;
        }
      }

      // Difficulty filter
      if (difficulty !== "all" && c.difficulty !== difficulty) {
        return false;
      }

      // Status filter
      if (status === "completed" && !c.completed) {
        return false;
      }
      if (
        status === "in_progress" &&
        (c.completed || (c.completion_percent || 0) <= 0)
      ) {
        return false;
      }
      if (
        status === "not_started" &&
        (c.completed || (c.completion_percent || 0) > 0)
      ) {
        return false;
      }

      return true;
    });
  }, [rawCampaigns, searchName, difficulty, status]);

  // Sort campaigns
  const campaigns = useMemo(() => {
    return [...filteredCampaigns].sort((a, b) => {
      if (sortBy === "name") {
        const diff = a.campaign_name.localeCompare(b.campaign_name);
        return sortOrder === "asc" ? diff : -diff;
      }

      let aVal = 0;
      let bVal = 0;

      switch (sortBy) {
        case "rating":
          aVal = Number(a.rating) || 0;
          bVal = Number(b.rating) || 0;
          break;
        case "difficulty":
          aVal = getDifficultyScore(a);
          bVal = getDifficultyScore(b);
          break;
        case "popularity":
          aVal = a.times_played || 0;
          bVal = b.times_played || 0;
          break;
        case "levels":
          aVal = a.level_count || 0;
          bVal = b.level_count || 0;
          break;
        case "progress":
          aVal = a.completion_percent || 0;
          bVal = b.completion_percent || 0;
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredCampaigns, sortBy, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const isFiltered =
    searchName.trim().length > 0 || difficulty !== "all" || status !== "all";

  const resetFilters = () => {
    setSearchName("");
    setDifficulty("all");
    setStatus("all");
  };

  const difficultyOptions = [
    { value: "all", label: t("campaignSelector.allDifficulties") },
    { value: "easy", label: t("campaignSelector.easy") },
    { value: "medium", label: t("campaignSelector.medium") },
    { value: "hard", label: t("campaignSelector.hard") },
    { value: "expert", label: t("campaignSelector.expert") },
  ];

  const statusOptions = [
    { value: "all", label: t("campaignSelector.allStatus") },
    { value: "completed", label: t("campaignSelector.completed") },
    { value: "in_progress", label: t("campaignSelector.inProgress") },
    { value: "not_started", label: t("campaignSelector.notStarted") },
  ];

  const sortOptions = [
    { value: "rating", label: t("campaignSelector.sortByRating") },
    { value: "difficulty", label: t("campaignSelector.sortByDifficulty") },
    { value: "popularity", label: t("campaignSelector.sortByPopularity") },
    { value: "levels", label: t("campaignSelector.sortByLevelCount") },
    { value: "progress", label: t("campaignSelector.sortByProgress") },
    { value: "name", label: t("campaignSelector.sortByName") },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Top search & create row */}
      <div className="flex gap-2.5 mb-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            className="pl-10 pr-9"
            placeholder={t("campaignSelector.searchPlaceholder")}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          {searchName && (
            <button
              type="button"
              onClick={() => setSearchName("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink p-1 rounded-full cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {isMy && onCreate && (
          <Button
            variant="green"
            onClick={onCreate}
            className="gap-1.5 shrink-0"
          >
            <Plus size={18} /> {t("campaignSelector.newCampaign")}
          </Button>
        )}
      </div>

      {/* Filter and sort toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-2.5 border-b-2 border-ink/10">
        {/* Difficulty Filter */}
        <div className="flex-1 min-w-[130px] sm:flex-initial">
          <Select
            aria-label={t("campaignSelector.filterDifficulty")}
            value={difficulty}
            onValueChange={setDifficulty}
            options={difficultyOptions}
            className="w-full text-xs py-2 px-3 h-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex-1 min-w-[130px] sm:flex-initial">
          <Select
            aria-label={t("campaignSelector.filterStatus")}
            value={status}
            onValueChange={setStatus}
            options={statusOptions}
            className="w-full text-xs py-2 px-3 h-10"
          />
        </div>

        {/* Sort Select */}
        <div className="flex-1 min-w-[130px] sm:flex-initial">
          <Select
            aria-label={t("campaignSelector.sortBy")}
            value={sortBy}
            onValueChange={setSortBy}
            options={sortOptions}
            className="w-full text-xs py-2 px-3 h-10"
          />
        </div>

        {/* Sort Order Toggle */}
        <IconButton
          size="sm"
          onClick={toggleSortOrder}
          className="size-10 shrink-0"
          aria-label={
            sortOrder === "asc"
              ? t("campaignSelector.ascending")
              : t("campaignSelector.descending")
          }
          title={
            sortOrder === "asc"
              ? t("campaignSelector.ascending")
              : t("campaignSelector.descending")
          }
        >
          {sortOrder === "asc" ? (
            <ArrowUp size={16} />
          ) : (
            <ArrowDown size={16} />
          )}
        </IconButton>

        {/* Clear Filters Button (shown when any filter is active) */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-1 text-xs text-ink-soft hover:text-ink h-10 ml-auto shrink-0 border-2 border-dashed border-ink/20"
          >
            <RotateCcw size={13} />
            <span>{t("campaignSelector.clearFilters")}</span>
          </Button>
        )}
      </div>

      {/* Results counter bar */}
      {!isLoading && rawCampaigns.length > 0 && (
        <div className="flex items-center justify-between text-xs font-semibold text-ink-soft px-1 mb-2">
          <span>
            {isFiltered
              ? t("campaignSelector.showingFiltered", {
                  filtered: campaigns.length,
                  total: rawCampaigns.length,
                })
              : t("campaignSelector.showingCount", {
                  count: campaigns.length,
                })}
          </span>
        </div>
      )}

      {/* Campaign List */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 pr-2 py-1">
        {isLoading ? (
          <div className="text-center py-12 text-ink-soft font-medium">
            {t("campaignSelector.loadingCampaigns")}
          </div>
        ) : rawCampaigns.length === 0 ? (
          <div className="text-center text-ink-soft py-12">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-40 text-ink" />
            <p className="font-bold text-base text-ink">
              {isMy
                ? t("campaignSelector.noCampaignsMine")
                : t("campaignSelector.noCampaigns")}
            </p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-ink-soft py-12 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-field border-3 border-ink flex items-center justify-center mb-3 text-ink-soft shadow-[0_3px_0_rgba(0,0,0,0.15)]">
              <SlidersHorizontal size={24} />
            </div>
            <p className="font-bold text-base text-ink mb-1">
              {t("campaignSelector.noMatchingCampaigns")}
            </p>
            <p className="text-xs text-ink-soft mb-4 max-w-xs">
              Try adjusting your search query, difficulty tier, or status
              filter.
            </p>
            <Button
              variant="blue"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5"
            >
              <RotateCcw size={14} />
              {t("campaignSelector.resetFilters")}
            </Button>
          </div>
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.campaign_id}
              campaignId={c.campaign_id}
              name={c.campaign_name}
              description={c.campaign_description}
              levelCount={c.level_count || 0}
              completionPercent={c.completion_percent || 0}
              completed={c.completed || false}
              author={c.campaign_creator_name}
              rating={c.rating}
              ratingCount={c.rating_count}
              difficulty={c.difficulty}
              difficultyScore={c.difficulty_score}
              timesPlayed={c.times_played}
              clearRate={c.clear_rate}
              enemyCount={c.enemy_count}
              onClick={() => (isMy ? undefined : onSelect?.(c.campaign_id))}
              {...(isMy && onPlay ? { onPlay } : {})}
              {...(isMy && onEdit ? { onEdit } : {})}
              {...(isMy && onDelete ? { onDelete } : {})}
            />
          ))
        )}
      </div>
    </div>
  );
}
