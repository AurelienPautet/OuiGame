import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AdminLoginItem, AdminAuditItem } from "@ouigame/shared/api";
import {
  DarkPanel,
  Input,
  Select,
  SegmentedControl,
  IconButton,
} from "../ui/primitives";
import { useAdminLogins, useAdminAudit } from "../../hooks/api";
import { cn } from "../../lib/cn";
import { humanizeLabel } from "./labels";

type Section = "logins" | "audit";
type LoginStatusFilter = "all" | "success" | "failed";

const PAGE_SIZE = 25;

// Map the segmented status filter onto the substring the server matches against
// the free-form `status` column (it's an enum-ish string, not normalised).
const STATUS_QUERY: Record<LoginStatusFilter, string | undefined> = {
  all: undefined,
  success: "success",
  failed: "fail",
};

// Format an ISO timestamp into a compact, locale-aware "MMM D, HH:MM" line.
function formatAt(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// success → green, anything mentioning fail → red, otherwise neutral grey.
function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("success")) return "bg-green text-white border-green-d";
  if (s.includes("fail")) return "bg-red text-white border-red-d";
  return "bg-white/15 text-white border-ink";
}

/** Small outlined status/label badge — the table's coloured pill motif. */
function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <span
      className={cn(
        "inline-block font-display font-bold text-[11px] uppercase tracking-wide border-2 rounded-full px-2.5 py-0.5",
        tone
      )}
    >
      {children}
    </span>
  );
}

// Compact JSON for the audit `details` payload, truncated so a fat blob can't
// blow out the row. Empty/nullish payloads render as an em dash.
function formatDetails(details: unknown): string {
  if (details === undefined || details === null) return "—";
  let out: string;
  try {
    out = typeof details === "string" ? details : JSON.stringify(details);
  } catch {
    return "—";
  }
  if (out === "{}" || out === '""' || out === "") return "—";
  return out.length > 80 ? `${out.slice(0, 79)}…` : out;
}

interface PagerProps {
  page: number;
  total: number;
  onChange: (page: number) => void;
}

// Prev/next pager + "x–y of total" readout, dark-panel styled.
function Pager({ page, total, onChange }: PagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-end gap-3 px-3.5 py-2.5">
      <span className="text-xs font-semibold text-white/60 tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <IconButton
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} strokeWidth={3} />
        </IconButton>
        <IconButton
          size="sm"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} strokeWidth={3} />
        </IconButton>
      </div>
    </div>
  );
}

// Shared column-grid wrappers keep header + rows aligned across the table body.
const LOGIN_COLS = "grid-cols-[140px_1fr_150px_110px]";
const AUDIT_COLS = "grid-cols-[140px_140px_160px_150px_1fr]";

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/50 truncate">
      {children}
    </span>
  );
}

function LoginsSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LoginStatusFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminLogins({
    page,
    pageSize: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(STATUS_QUERY[status] ? { status: STATUS_QUERY[status] } : {}),
  });

  const logins: AdminLoginItem[] = data?.logins ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={18}
            strokeWidth={2.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/70 pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search username or IP"
            aria-label="Search logins"
            className="pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as LoginStatusFilter);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="min-w-[150px]"
          options={[
            { value: "all", label: "All status" },
            { value: "success", label: "Success" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>

      <DarkPanel className="p-2">
        <div
          className={cn(
            "grid gap-3 px-3.5 py-2.5 border-b-2 border-white/10",
            LOGIN_COLS
          )}
        >
          <HeaderCell>Time</HeaderCell>
          <HeaderCell>Username</HeaderCell>
          <HeaderCell>IP</HeaderCell>
          <HeaderCell>Status</HeaderCell>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-white/60 py-8">Loading logins…</p>
          ) : logins.length === 0 ? (
            <p className="text-center text-white/60 py-8">
              No login attempts found.
            </p>
          ) : (
            logins.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "grid gap-3 items-center px-3.5 py-2.5 rounded-lg odd:bg-white/5",
                  LOGIN_COLS
                )}
              >
                <span className="text-sm text-white/70 font-medium tabular-nums truncate">
                  {formatAt(row.at)}
                </span>
                <span className="text-sm text-white font-semibold truncate">
                  {row.username ?? "—"}
                </span>
                <span className="text-sm text-white/70 font-mono truncate">
                  {row.ip}
                </span>
                <span>
                  {/* Colour from the raw enum string; show a humanised label. */}
                  <Badge tone={statusTone(row.status)}>
                    {humanizeLabel(row.status)}
                  </Badge>
                </span>
              </div>
            ))
          )}
        </div>

        {total > 0 && <Pager page={page} total={total} onChange={setPage} />}
      </DarkPanel>
    </div>
  );
}

function AuditSection() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminAudit({
    page,
    pageSize: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const entries: AdminAuditItem[] = data?.entries ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative max-w-[360px]">
        <Search
          size={18}
          strokeWidth={2.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/70 pointer-events-none"
        />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search action"
          aria-label="Search audit log"
          className="pl-10"
        />
      </div>

      <DarkPanel className="p-2">
        <div
          className={cn(
            "grid gap-3 px-3.5 py-2.5 border-b-2 border-white/10",
            AUDIT_COLS
          )}
        >
          <HeaderCell>Time</HeaderCell>
          <HeaderCell>Actor</HeaderCell>
          <HeaderCell>Action</HeaderCell>
          <HeaderCell>Target</HeaderCell>
          <HeaderCell>Details</HeaderCell>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-white/60 py-8">Loading audit log…</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-white/60 py-8">
              No audit entries found.
            </p>
          ) : (
            entries.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "grid gap-3 items-center px-3.5 py-2.5 rounded-lg odd:bg-white/5",
                  AUDIT_COLS
                )}
              >
                <span className="text-sm text-white/70 font-medium tabular-nums truncate">
                  {formatAt(row.at)}
                </span>
                <span className="text-sm text-white font-semibold truncate">
                  {row.actorName ?? "system"}
                </span>
                <span>
                  <Badge tone="bg-purple text-white border-purple-d">
                    {humanizeLabel(row.action)}
                  </Badge>
                </span>
                <span className="text-sm text-white/70 font-medium truncate">
                  {row.targetType
                    ? `${row.targetType}${row.targetId !== null ? ` #${row.targetId}` : ""}`
                    : "—"}
                </span>
                <span
                  className="text-xs text-white/60 font-mono truncate"
                  title={formatDetails(row.details)}
                >
                  {formatDetails(row.details)}
                </span>
              </div>
            ))
          )}
        </div>

        {total > 0 && <Pager page={page} total={total} onChange={setPage} />}
      </DarkPanel>
    </div>
  );
}

/**
 * Security tab of the admin dashboard — two switchable sections: the login
 * attempt log (searchable, status-filterable) and the admin action audit
 * trail (searchable). Both paginate server-side.
 */
export function SecurityTab() {
  const [section, setSection] = useState<Section>("logins");

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<Section>
        value={section}
        onValueChange={setSection}
        options={[
          { value: "logins", label: "Logins" },
          { value: "audit", label: "Audit" },
        ]}
        aria-label="Security section"
      />

      {section === "logins" ? <LoginsSection /> : <AuditSection />}
    </div>
  );
}
