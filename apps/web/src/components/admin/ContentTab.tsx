import { useState } from "react";
import { Search, Trash2, ToggleLeft, ToggleRight, Star } from "lucide-react";
import {
  useAdminLevels,
  useAdminCampaigns,
  useUpdateAdminLevel,
  useDeleteAdminLevel,
  useDeleteAdminCampaign,
} from "../../hooks/api";
import type {
  AdminLevelListItem,
  AdminCampaignListItem,
  AdminLevelsQuery,
} from "@ouigame/shared/api";
import {
  DarkPanel,
  SegmentedControl,
  SectionLabel,
  Input,
  Select,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Tooltip,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

type Section = "levels" | "campaigns";
type LevelStatus = NonNullable<AdminLevelsQuery["status"]> | "all";
type LevelSort = NonNullable<AdminLevelsQuery["sort"]>;

const PAGE_SIZE = 25;

// --- helpers -----------------------------------------------------------------

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

// Pull the human row count out of a paginated response so the footer reads
// "Showing 1–25 of 312" without re-deriving the math at every call site.
const pageRange = (
  page: number,
  pageSize: number,
  count: number,
  total: number
) => {
  if (total === 0) return "0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = start + count - 1;
  return `${start}–${end} of ${total}`;
};

// --- shared layout bits ------------------------------------------------------

const Th = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "px-3 py-2 text-[11px] font-bold uppercase tracking-[1.5px] text-white/60",
      className
    )}
  >
    {children}
  </div>
);

const Td = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("px-3 py-2.5 text-sm text-white/90 truncate", className)}>
    {children}
  </div>
);

const StateRow = ({ children }: { children: React.ReactNode }) => (
  <div className="py-10 text-center text-white/55 font-semibold">
    {children}
  </div>
);

interface Pager {
  page: number;
  total: number;
  shown: number;
  onPrev: () => void;
  onNext: () => void;
}

const Pagination = ({ page, total, shown, onPrev, onNext }: Pager) => {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-3">
      <span className="text-xs font-semibold text-white/55 tabular-nums">
        Showing {pageRange(page, PAGE_SIZE, shown, total)}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1}>
          Prev
        </Button>
        <span className="text-xs font-bold text-white/70 tabular-nums min-w-[64px] text-center">
          {page} / {lastPage}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={page >= lastPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

// --- confirm-delete dialog ---------------------------------------------------

interface ConfirmState {
  kind: Section;
  id: number;
  name: string;
}

const ConfirmDelete = ({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: ConfirmState;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Dialog
    open
    onOpenChange={(o) => {
      if (!o) onCancel();
    }}
  >
    <DialogContent widthClassName="w-[min(92vw,440px)]">
      <DialogTitle className="text-xl font-extrabold mb-2">
        Delete {target.kind === "levels" ? "level" : "campaign"}?
      </DialogTitle>
      <p className="text-ink-soft text-sm mb-5">
        This permanently removes{" "}
        <span className="font-bold text-ink">{target.name}</span> and its
        related data. This cannot be undone.
      </p>
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="red" size="sm" onClick={onConfirm} disabled={pending}>
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

// --- Levels section ----------------------------------------------------------

const LEVEL_SORTS: { value: LevelSort; label: string }[] = [
  { value: "created", label: "Newest" },
  { value: "plays", label: "Most played" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "Name (A–Z)" },
];

const STATUS_FILTERS: { value: LevelStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
];

const StatusChip = ({ status }: { status: string }) => {
  const up = status === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        up ? "bg-green text-ink" : "bg-white/15 text-white/70"
      )}
    >
      <span
        className={cn("size-2 rounded-full", up ? "bg-ink" : "bg-white/50")}
      />
      {up ? "Up" : "Down"}
    </span>
  );
};

const RatingCell = ({
  rating,
  count,
}: {
  rating: number | null;
  count: number;
}) =>
  rating == null || count === 0 ? (
    <span className="text-white/40">—</span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <Star size={14} className="fill-yellow text-yellow-d shrink-0" />
      <span className="font-bold tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-white/45 text-xs tabular-nums">({count})</span>
    </span>
  );

const LevelsSection = ({
  onDelete,
}: {
  onDelete: (t: ConfirmState) => void;
}) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LevelStatus>("all");
  const [sort, setSort] = useState<LevelSort>("created");
  const [page, setPage] = useState(1);

  const params: AdminLevelsQuery = {
    sort,
    page,
    pageSize: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status !== "all" ? { status } : {}),
  };

  const { data, isLoading, isError } = useAdminLevels(params);
  const toggleLevel = useUpdateAdminLevel();

  const levels = data?.levels ?? [];
  const total = data?.total ?? 0;

  // Filters narrow the result set — reset to page 1 so we never land on an
  // empty trailing page.
  const resetPage = () => setPage(1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search levels…"
            aria-label="Search levels"
            className="pl-10"
          />
        </div>
        <SegmentedControl<LevelStatus>
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            resetPage();
          }}
          options={STATUS_FILTERS}
          aria-label="Filter by status"
        />
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as LevelSort);
            resetPage();
          }}
          options={LEVEL_SORTS}
          aria-label="Sort levels"
          className="min-w-[150px]"
        />
      </div>

      {/* header */}
      <div className="hidden md:grid grid-cols-[1.6fr_1.1fr_0.7fr_0.8fr_0.7fr_1fr_0.9fr_auto] items-center border-b-2 border-white/10">
        <Th>Name</Th>
        <Th>Creator</Th>
        <Th>Type</Th>
        <Th>Status</Th>
        <Th className="text-right">Plays</Th>
        <Th>Rating</Th>
        <Th>Created</Th>
        <Th className="text-right">Actions</Th>
      </div>

      {isLoading ? (
        <StateRow>Loading levels…</StateRow>
      ) : isError ? (
        <StateRow>Couldn’t load levels.</StateRow>
      ) : levels.length === 0 ? (
        <StateRow>No levels match your filters.</StateRow>
      ) : (
        levels.map((lvl: AdminLevelListItem) => {
          const up = lvl.status === "up";
          const busy = toggleLevel.isPending;
          return (
            <div
              key={lvl.id}
              className="grid grid-cols-2 md:grid-cols-[1.6fr_1.1fr_0.7fr_0.8fr_0.7fr_1fr_0.9fr_auto] items-center rounded-lg odd:bg-white/5 hover:bg-white/10"
            >
              <Td className="font-bold text-white col-span-2 md:col-span-1">
                {lvl.name}
              </Td>
              <Td className="text-white/70">{lvl.creatorName ?? "—"}</Td>
              <Td className="uppercase text-xs font-bold text-white/60">
                {lvl.type}
              </Td>
              <Td>
                <StatusChip status={lvl.status} />
              </Td>
              <Td className="text-right tabular-nums font-bold">{lvl.plays}</Td>
              <Td>
                <RatingCell rating={lvl.rating} count={lvl.ratingCount} />
              </Td>
              <Td className="text-white/60 text-xs tabular-nums">
                {fmtDate(lvl.createdAt)}
              </Td>
              <Td className="flex justify-end gap-2">
                <Tooltip content={up ? "Take down" : "Publish"}>
                  <IconButton
                    size="sm"
                    aria-label={up ? "Take level down" : "Publish level"}
                    disabled={busy}
                    onClick={() =>
                      toggleLevel.mutate({
                        id: lvl.id,
                        status: up ? "down" : "up",
                      })
                    }
                  >
                    {up ? (
                      <ToggleRight size={18} className="text-green-d" />
                    ) : (
                      <ToggleLeft size={18} className="text-ink-soft" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip content="Delete">
                  <IconButton
                    size="sm"
                    aria-label="Delete level"
                    className="text-red"
                    onClick={() =>
                      onDelete({ kind: "levels", id: lvl.id, name: lvl.name })
                    }
                  >
                    <Trash2 size={17} />
                  </IconButton>
                </Tooltip>
              </Td>
            </div>
          );
        })
      )}

      {!isLoading && !isError && total > 0 && (
        <Pagination
          page={page}
          total={total}
          shown={levels.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
};

// --- Campaigns section -------------------------------------------------------

const CampaignsSection = ({
  onDelete,
}: {
  onDelete: (t: ConfirmState) => void;
}) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const { data, isLoading, isError } = useAdminCampaigns(params);

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search campaigns…"
            aria-label="Search campaigns"
            className="pl-10"
          />
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[1.8fr_1.2fr_0.9fr_0.8fr_1fr_1fr_auto] items-center border-b-2 border-white/10">
        <Th>Name</Th>
        <Th>Creator</Th>
        <Th className="text-right">Levels</Th>
        <Th className="text-right">Runs</Th>
        <Th className="text-right">Completions</Th>
        <Th>Created</Th>
        <Th className="text-right">Actions</Th>
      </div>

      {isLoading ? (
        <StateRow>Loading campaigns…</StateRow>
      ) : isError ? (
        <StateRow>Couldn’t load campaigns.</StateRow>
      ) : campaigns.length === 0 ? (
        <StateRow>No campaigns match your search.</StateRow>
      ) : (
        campaigns.map((c: AdminCampaignListItem) => (
          <div
            key={c.id}
            className="grid grid-cols-2 md:grid-cols-[1.8fr_1.2fr_0.9fr_0.8fr_1fr_1fr_auto] items-center rounded-lg odd:bg-white/5 hover:bg-white/10"
          >
            <Td className="font-bold text-white col-span-2 md:col-span-1">
              {c.name}
            </Td>
            <Td className="text-white/70">{c.creatorName ?? "—"}</Td>
            <Td className="text-right tabular-nums">{c.levelCount}</Td>
            <Td className="text-right tabular-nums font-bold">{c.runs}</Td>
            <Td className="text-right tabular-nums">
              <span className="text-green font-bold">{c.completions}</span>
            </Td>
            <Td className="text-white/60 text-xs tabular-nums">
              {fmtDate(c.createdAt)}
            </Td>
            <Td className="flex justify-end">
              <Tooltip content="Delete">
                <IconButton
                  size="sm"
                  aria-label="Delete campaign"
                  className="text-red"
                  onClick={() =>
                    onDelete({ kind: "campaigns", id: c.id, name: c.name })
                  }
                >
                  <Trash2 size={17} />
                </IconButton>
              </Tooltip>
            </Td>
          </div>
        ))
      )}

      {!isLoading && !isError && total > 0 && (
        <Pagination
          page={page}
          total={total}
          shown={campaigns.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
};

// --- ContentTab --------------------------------------------------------------

export const ContentTab = () => {
  const [section, setSection] = useState<Section>("levels");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const deleteLevel = useDeleteAdminLevel();
  const deleteCampaign = useDeleteAdminCampaign();
  const pending =
    confirm?.kind === "levels"
      ? deleteLevel.isPending
      : deleteCampaign.isPending;

  const runDelete = () => {
    if (!confirm) return;
    const onSuccess = () => setConfirm(null);
    if (confirm.kind === "levels") {
      deleteLevel.mutate({ id: confirm.id }, { onSuccess });
    } else {
      deleteCampaign.mutate({ id: confirm.id }, { onSuccess });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Section>
          value={section}
          onValueChange={setSection}
          options={[
            { value: "levels", label: "Levels" },
            { value: "campaigns", label: "Campaigns" },
          ]}
          aria-label="Content type"
        />
        <SectionLabel>Content moderation</SectionLabel>
      </div>

      <DarkPanel className="p-3 sm:p-4">
        {section === "levels" ? (
          <LevelsSection onDelete={setConfirm} />
        ) : (
          <CampaignsSection onDelete={setConfirm} />
        )}
      </DarkPanel>

      {confirm && (
        <ConfirmDelete
          target={confirm}
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={runDelete}
        />
      )}
    </div>
  );
};
