import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Gamepad2,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { LevelCard } from "./LevelCard";
import { hexToDataUrl } from "../../utils/levelUtils";
import { useLevels, useMyLevels } from "../../hooks/api";
import { storage } from "../../lib/storage";
import type { LevelDTO } from "@ouigame/shared/api";

// Persisted (localStorage) solo-browser UI state.
interface SoloSelectorState {
  searchName: string;
  sortBy: string;
  sortOrder: string;
  scrollTop: number;
}

/**
 * LevelSelector - Reusable level selection component
 */
interface LevelSelectorProps {
  mode?: "solo" | "room" | "myLevels" | "pick";
  onSelect?: (levelId: number) => void; // solo mode
  onMultiSelect?: (levelIds: number[]) => void; // room mode
  onEdit?: (levelId: number) => void; // myLevels mode
  onDelete?: (levelId: number) => void; // myLevels mode
  onCreate?: () => void; // "Create New" clicked (myLevels mode)
  onPick?: (level: LevelDTO) => void; // full level object picked (pick mode)
  pickedIds?: number[]; // already-picked ids, shown as "Added" (pick mode)
}

export function LevelSelector({
  mode = "solo",
  onSelect,
  onMultiSelect,
  onEdit,
  onDelete,
  onCreate,
  onPick,
  pickedIds = [],
}: LevelSelectorProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const savedState = useMemo(() => {
    if (mode !== "solo") return null;
    return storage.getSoloSelectorState<SoloSelectorState>();
  }, [mode]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchName, setSearchName] = useState(savedState?.searchName || "");
  const [maxPlayers, setMaxPlayers] = useState(0);

  // Solo mode sorting
  const [sortBy, setSortBy] = useState(savedState?.sortBy || "rating");
  const [sortOrder, setSortOrder] = useState(savedState?.sortOrder || "desc");

  // Restore scroll position after levels load
  useEffect(() => {
    if (mode === "solo" && savedState?.scrollTop && listRef.current) {
      // Small delay to let content render
      const timer = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = savedState.scrollTop;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, savedState?.scrollTop]);

  useEffect(() => {
    if (mode === "solo") {
      const state: SoloSelectorState = {
        searchName,
        sortBy,
        sortOrder,
        scrollTop: listRef.current?.scrollTop || 0,
      };
      storage.setSoloSelectorState(state);
    }
  }, [mode, searchName, sortBy, sortOrder]);

  // Determine API parameters based on mode
  const isPick = mode === "pick";
  const showPlayerFilter = mode === "room" || mode === "myLevels";
  const isMultiSelect = mode === "room";
  const showActions = mode === "myLevels";
  const levelType = mode === "solo" || isPick ? "solo" : "online";
  const showSoloFilters = mode === "solo" || isPick;

  // Use appropriate hook based on mode
  const levelsQuery =
    mode === "myLevels"
      ? useMyLevels({ name: searchName, players: maxPlayers })
      : useLevels({ name: searchName, players: maxPlayers, type: levelType });

  const rawLevels = levelsQuery.data || [];
  const isLoading = levelsQuery.isLoading;

  // Sort levels client-side for solo mode
  const levels = useMemo(() => {
    if (!showSoloFilters) return rawLevels;

    return [...rawLevels].sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case "rating":
          // level_rating is an un-coerced aggregate (string when present).
          aVal = Number(a.level_rating) || 0;
          bVal = Number(b.level_rating) || 0;
          break;
        case "success_rate":
          aVal = a.solo_success_rate || 0;
          bVal = b.solo_success_rate || 0;
          break;
        case "times_played":
          aVal = a.solo_times_played || 0;
          bVal = b.solo_times_played || 0;
          break;
        case "best_time":
          // For best time, treat null as Infinity (worst)
          aVal = a.solo_best_time_ms || Infinity;
          bVal = b.solo_best_time_ms || Infinity;
          break;
        default:
          return 0;
      }

      if (sortOrder === "asc") {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }, [rawLevels, sortBy, sortOrder, showSoloFilters]);

  const handleCardClick = (level: LevelDTO) => {
    if (showActions) return; // myLevels mode uses buttons instead

    if (isPick) {
      // Campaign editor: clicking a card adds it (pass full level for its name)
      onPick?.(level);
      return;
    }

    const levelId = level.level_id;
    if (isMultiSelect) {
      // Toggle selection for room mode
      setSelectedIds((prev) =>
        prev.includes(levelId)
          ? prev.filter((id) => id !== levelId)
          : [...prev, levelId]
      );
    } else {
      // Single select for solo mode
      setSelectedIds([levelId]);
      onSelect?.(levelId);
    }
  };

  // Notify parent of multi-selection changes
  useEffect(() => {
    if (isMultiSelect) {
      onMultiSelect?.(selectedIds);
    }
  }, [selectedIds, isMultiSelect, onMultiSelect]);

  const handleDelete = (
    levelId: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this level?")) {
      onDelete?.(levelId);
    }
  };

  const handleEdit = (
    levelId: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    onEdit?.(levelId);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <label className="input input-bordered flex items-center gap-2 flex-1 min-w-48 bg-base-200">
          <Search className="w-4 h-4 opacity-70" />
          <input
            type="text"
            className="grow bg-transparent"
            placeholder="Search level name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </label>

        {showPlayerFilter && (
          <select
            className="select select-bordered bg-base-200"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
          >
            <option value={0}>Any players</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} player{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        )}

        {/* Solo mode sorting controls */}
        {showSoloFilters && (
          <>
            <select
              className="select select-bordered bg-base-200"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="rating">Sort by Rating</option>
              <option value="success_rate">Sort by Success Rate</option>
              <option value="times_played">Sort by Popularity</option>
              <option value="best_time">Sort by Best Time</option>
            </select>
            <button
              className="btn btn-square btn-ghost"
              onClick={toggleSortOrder}
              title={sortOrder === "desc" ? "Descending" : "Ascending"}
            >
              {sortOrder === "desc" ? (
                <ArrowDown className="w-5 h-5" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </>
        )}

        {mode === "myLevels" && onCreate && (
          <button className="btn btn-primary gap-2" onClick={onCreate}>
            <Plus className="w-5 h-5" />
            New Level
          </button>
        )}
      </div>

      {/* Selection info for room mode */}
      {isMultiSelect && selectedIds.length > 0 && (
        <div className="alert alert-info mb-4 py-2">
          <span>{selectedIds.length} level(s) selected</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* Level List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2"
        onScroll={() => {
          if (mode === "solo" && listRef.current) {
            const state: SoloSelectorState = {
              searchName,
              sortBy,
              sortOrder,
              scrollTop: listRef.current.scrollTop,
            };
            storage.setSoloSelectorState(state);
          }
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : levels.length === 0 ? (
          <div className="text-center text-base-content/50 py-8">
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>
              {mode === "myLevels"
                ? "No levels yet. Create your first level!"
                : "No levels found"}
            </p>
          </div>
        ) : (
          levels.map((level) => (
            <div key={level.level_id} className="relative group">
              <LevelCard
                levelId={level.level_id}
                levelName={level.level_name}
                levelJson={
                  (level.level_json as { data?: number[] } | null)?.data || []
                }
                rating={level.level_rating || 0}
                thumbnailSrc={hexToDataUrl(level.level_img ?? "")}
                onClick={() => handleCardClick(level)}
                selected={
                  isPick
                    ? pickedIds.includes(level.level_id)
                    : selectedIds.includes(level.level_id)
                }
                author={level.level_creator_name}
                isSolo={mode === "solo" || isPick}
                soloTimesPlayed={level.solo_times_played || 0}
                soloSuccessRate={level.solo_success_rate || 0}
                soloBestTimeMs={level.solo_best_time_ms}
              />

              {/* "Added" badge for pick mode */}
              {isPick && pickedIds.includes(level.level_id) && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 badge badge-primary gap-1">
                  <Plus className="w-3 h-3" />
                  Added
                </div>
              )}

              {/* Action buttons for myLevels mode */}
              {showActions && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="btn btn-sm btn-primary gap-1"
                    onClick={(e) => handleEdit(level.level_id, e)}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-error btn-outline gap-1"
                    onClick={(e) => handleDelete(level.level_id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
