import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Gamepad2,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { LevelCard } from "./LevelCard";
import { hexToDataUrl } from "../../utils/levelUtils";
import { useLevels, useMyLevels } from "../../hooks/api";
import { storage } from "../../lib/storage";
import type { LevelDTO } from "@ouigame/shared/api";
import { Input, Select, Button, IconButton } from "./primitives";

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
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            className="pl-10"
            placeholder="Search level name…"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        {showPlayerFilter && (
          <Select
            aria-label="Filter by player count"
            value={String(maxPlayers)}
            onValueChange={(v) => setMaxPlayers(parseInt(v))}
            options={[
              { value: "0", label: "Any players" },
              ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
                value: String(n),
                label: `${n} player${n > 1 ? "s" : ""}`,
              })),
            ]}
          />
        )}

        {/* Solo mode sorting controls */}
        {showSoloFilters && (
          <>
            <Select
              aria-label="Sort levels by"
              value={sortBy}
              onValueChange={setSortBy}
              options={[
                { value: "rating", label: "Sort by Rating" },
                { value: "success_rate", label: "Sort by Success Rate" },
                { value: "times_played", label: "Sort by Popularity" },
                { value: "best_time", label: "Sort by Best Time" },
              ]}
            />
            <IconButton
              onClick={toggleSortOrder}
              title={sortOrder === "desc" ? "Descending" : "Ascending"}
            >
              {sortOrder === "desc" ? (
                <ArrowDown size={20} />
              ) : (
                <ArrowUp size={20} />
              )}
            </IconButton>
          </>
        )}

        {mode === "myLevels" && onCreate && (
          <Button variant="green" onClick={onCreate}>
            <Plus size={20} /> New Level
          </Button>
        )}
      </div>

      {/* Selection info for room mode */}
      {isMultiSelect && selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-4 bg-blue/15 border-[3px] border-ink rounded-xl px-4 py-2 text-ink font-semibold">
          <span>{selectedIds.length} level(s) selected</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
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
          <div className="text-center py-8 text-ink-soft">Loading levels…</div>
        ) : levels.length === 0 ? (
          <div className="text-center text-ink-soft py-8">
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="font-semibold">
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 bg-blue text-white text-xs font-bold border-2 border-ink rounded-full px-2.5 py-1">
                  <Plus size={12} strokeWidth={3} />
                  Added
                </div>
              )}

              {/* Action buttons for myLevels mode */}
              {showActions && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="blue"
                    size="sm"
                    onClick={(e) => handleEdit(level.level_id, e)}
                  >
                    <Pencil size={16} /> Edit
                  </Button>
                  <Button
                    variant="red"
                    size="sm"
                    onClick={(e) => handleDelete(level.level_id, e)}
                  >
                    <Trash2 size={16} /> Delete
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
