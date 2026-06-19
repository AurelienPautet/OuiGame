import { useState, type FormEvent } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import type { AdminUserListItem, AdminUsersQuery } from "@ouigame/shared/api";
import {
  useAdminUsers,
  useUpdateAdminUser,
  useDeleteAdminUser,
} from "../../hooks/api";
import { useAuth } from "../../contexts";
import {
  DarkPanel,
  Input,
  Select,
  SegmentedControl,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/primitives";
import { cn } from "../../lib/cn";
import { UserDetailModal } from "./UserDetailModal";

type SortKey = NonNullable<AdminUsersQuery["sort"]>;
type Order = NonNullable<AdminUsersQuery["order"]>;
type TypeFilter = "all" | NonNullable<AdminUsersQuery["type"]>;

const PAGE_SIZE = 25;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created", label: "Joined" },
  { value: "username", label: "Name" },
  { value: "kills", label: "Kills" },
  { value: "wins", label: "Wins" },
  { value: "rounds", label: "Rounds" },
  { value: "levels", label: "Levels" },
];

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";

// The api client surfaces the parsed error body as `.message`; the self-action
// guard on the server returns a 400 with a human message we just pass through.
const errMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : "Something went wrong.";

export const UsersTab = () => {
  const { user: me } = useAuth();

  // Committed search term (drives the query); the input is its own draft state
  // so typing doesn't refetch on every keystroke — submit/Enter commits it.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [order, setOrder] = useState<Order>("desc");
  const [type, setType] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: "promote" | "demote" | "delete";
    user: AdminUserListItem;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params: AdminUsersQuery = {
    sort,
    order,
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(type !== "all" ? { type } : {}),
  };

  const { data, isLoading, isError } = useAdminUsers(params);
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const changeSort = (next: SortKey) => {
    setSort(next);
    setPage(1);
  };

  const toggleOrder = () => {
    setOrder((o) => (o === "asc" ? "desc" : "asc"));
    setPage(1);
  };

  const changeType = (next: TypeFilter) => {
    setType(next);
    setPage(1);
  };

  // `useAuth` only carries username/email/isAdmin (no id), so we self-detect by
  // username to disable our own row's destructive actions client-side. The
  // server is still the source of truth and blocks self-actions with a 400.
  const isSelf = (u: AdminUserListItem) => !!me && u.username === me.username;

  const runConfirm = () => {
    if (!confirm) return;
    setActionError(null);
    const { kind, user } = confirm;
    const onError = (e: unknown) => setActionError(errMessage(e));
    if (kind === "delete") {
      deleteUser.mutate(
        { id: user.id },
        { onSuccess: () => setConfirm(null), onError }
      );
    } else {
      updateUser.mutate(
        { id: user.id, isAdmin: kind === "promote" },
        { onSuccess: () => setConfirm(null), onError }
      );
    }
  };

  const mutating = updateUser.isPending || deleteUser.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submitSearch} className="relative flex-1 min-w-[220px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by username or email…"
            aria-label="Search users"
            className="pl-10"
          />
        </form>

        <Select
          value={sort}
          onValueChange={(v) => changeSort(v as SortKey)}
          options={SORT_OPTIONS}
          aria-label="Sort users by"
        />

        <Tooltip content={order === "asc" ? "Ascending" : "Descending"}>
          <IconButton onClick={toggleOrder} aria-label="Toggle sort order">
            {order === "asc" ? (
              <ArrowUp size={18} strokeWidth={3} />
            ) : (
              <ArrowDown size={18} strokeWidth={3} />
            )}
          </IconButton>
        </Tooltip>

        <SegmentedControl<TypeFilter>
          value={type}
          onValueChange={changeType}
          options={[
            { value: "all", label: "All" },
            { value: "db", label: "Email" },
            { value: "google", label: "Google" },
          ]}
          aria-label="Filter by account type"
        />
      </div>

      {/* Table */}
      <DarkPanel className="p-0 overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[2fr_1.4fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 border-b-[3px] border-ink/60 text-[11px] font-bold uppercase tracking-wide text-white/60">
          <span>User</span>
          <span>Joined / Last seen</span>
          <span className="text-right w-16">Rounds</span>
          <span className="text-right w-12">Kills</span>
          <span className="text-right w-12">Wins</span>
          <span className="text-right w-16">Content</span>
          <span className="text-right w-[120px]">Actions</span>
        </div>

        {isLoading ? (
          <p className="text-center text-white/60 py-10 font-semibold">
            Loading users…
          </p>
        ) : isError ? (
          <p className="text-center text-red py-10 font-bold">
            Failed to load users.
          </p>
        ) : users.length === 0 ? (
          <div className="text-center text-white/60 py-12">
            <UsersIcon size={36} className="mx-auto mb-2 opacity-50" />
            <p className="font-semibold">No users match these filters.</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                self={isSelf(u)}
                onView={() => setDetailId(u.id)}
                onTogglePromote={() =>
                  setConfirm({
                    kind: u.isAdmin ? "demote" : "promote",
                    user: u,
                  })
                }
                onDelete={() => setConfirm({ kind: "delete", user: u })}
              />
            ))}
          </div>
        )}
      </DarkPanel>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-soft">
          {total} user{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="text-sm font-bold text-ink tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pageCount || isLoading}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Detail drawer */}
      {detailId !== null && (
        <UserDetailModal userId={detailId} onClose={() => setDetailId(null)} />
      )}

      {/* Confirm dialog (promote / demote / delete) */}
      {confirm && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setConfirm(null);
              setActionError(null);
            }
          }}
        >
          <DialogContent widthClassName="w-[min(92vw,440px)]">
            <DialogTitle className="text-xl font-extrabold mb-1">
              {confirm.kind === "delete"
                ? "Delete user"
                : confirm.kind === "promote"
                  ? "Promote to admin"
                  : "Revoke admin"}
            </DialogTitle>
            <DialogDescription className="text-ink-soft font-semibold mb-4">
              {confirm.kind === "delete" ? (
                <>
                  Permanently delete{" "}
                  <strong className="text-ink">{confirm.user.username}</strong>{" "}
                  and all of their data? This can’t be undone.
                </>
              ) : confirm.kind === "promote" ? (
                <>
                  Grant admin access to{" "}
                  <strong className="text-ink">{confirm.user.username}</strong>?
                </>
              ) : (
                <>
                  Remove admin access from{" "}
                  <strong className="text-ink">{confirm.user.username}</strong>?
                </>
              )}
            </DialogDescription>

            {actionError && (
              <p className="mb-3 text-sm font-bold text-red bg-red/10 border-2 border-red rounded-lg px-3 py-2">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirm(null);
                  setActionError(null);
                }}
                disabled={mutating}
              >
                Cancel
              </Button>
              <Button
                variant={confirm.kind === "delete" ? "red" : "blue"}
                size="sm"
                onClick={runConfirm}
                disabled={mutating}
              >
                {mutating
                  ? "Working…"
                  : confirm.kind === "delete"
                    ? "Delete"
                    : "Confirm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

interface UserRowProps {
  user: AdminUserListItem;
  self: boolean;
  onView: () => void;
  onTogglePromote: () => void;
  onDelete: () => void;
}

const UserRow = ({
  user,
  self,
  onView,
  onTogglePromote,
  onDelete,
}: UserRowProps) => {
  const content = user.levelsCreated + user.campaignsCreated;
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-[2fr_1.4fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3",
        "odd:bg-white/5 hover:bg-white/10 transition-colors"
      )}
    >
      {/* User */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white truncate">{user.username}</span>
          {user.isAdmin && (
            <Chip
              active
              className="bg-green text-ink border-green-d pointer-events-none cursor-default text-[11px] px-2 py-0.5"
            >
              <ShieldCheck size={12} className="mr-1 inline" />
              Admin
            </Chip>
          )}
          {self && (
            <span className="bg-yellow text-ink text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border-2 border-ink">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60 truncate">
          <span className="truncate">{user.email}</span>
          <span className="bg-white/10 border border-white/20 rounded px-1 py-px text-[10px] font-bold uppercase shrink-0">
            {user.type}
          </span>
        </div>
      </div>

      {/* Joined / last seen */}
      <div className="text-xs text-white/70 font-semibold">
        <div>{fmtDate(user.createdAt)}</div>
        <div className="text-white/50">{fmtDate(user.lastLoginAt)}</div>
      </div>

      {/* Rounds (online + solo) */}
      <div className="text-right w-16 text-white font-bold tabular-nums">
        {user.onlineRounds + user.soloRounds}
        <div className="text-[10px] font-semibold text-white/50">
          {user.onlineRounds}o · {user.soloRounds}s
        </div>
      </div>

      {/* Kills */}
      <div className="text-right w-12 text-red font-bold tabular-nums">
        {user.kills}
      </div>

      {/* Wins */}
      <div className="text-right w-12 text-yellow font-bold tabular-nums">
        {user.wins}
      </div>

      {/* Content (levels / campaigns / achievements) */}
      <div className="text-right w-16 text-white/80 font-semibold tabular-nums">
        {content}
        <div className="text-[10px] text-white/50">{user.achievements}🏅</div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 w-[120px]">
        <Tooltip content="View profile">
          <IconButton size="sm" onClick={onView} aria-label="View user">
            <Eye size={16} strokeWidth={2.5} />
          </IconButton>
        </Tooltip>
        <Tooltip
          content={
            self
              ? "Can’t change yourself"
              : user.isAdmin
                ? "Revoke admin"
                : "Promote to admin"
          }
        >
          <IconButton
            size="sm"
            disabled={self}
            onClick={onTogglePromote}
            aria-label={user.isAdmin ? "Demote user" : "Promote user"}
          >
            {user.isAdmin ? (
              <ShieldOff
                size={16}
                strokeWidth={2.5}
                className="text-orange-d"
              />
            ) : (
              <ShieldCheck
                size={16}
                strokeWidth={2.5}
                className="text-green-d"
              />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip content={self ? "Can’t delete yourself" : "Delete user"}>
          <IconButton
            size="sm"
            disabled={self}
            onClick={onDelete}
            aria-label="Delete user"
          >
            <Trash2 size={16} strokeWidth={2.5} className="text-red" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};
