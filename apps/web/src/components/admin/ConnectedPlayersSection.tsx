import { useState, useMemo } from "react";
import {
  ShieldCheck,
  User,
  Radio,
  Gamepad2,
  Clock,
  Search,
  RefreshCw,
  Eye,
} from "lucide-react";
import type { AdminConnectedPlayer } from "@ouigame/shared/api";
import { useAdminConnectedPlayers } from "../../hooks/api";
import { formatDurationMs } from "../../lib/formatTime";
import { Panel, Button, IconButton, Input, Tooltip } from "../ui/primitives";
import { UserDetailModal } from "./UserDetailModal";
import { cn } from "../../lib/cn";

type FilterType = "all" | "registered" | "guest";

interface ConnectedPlayersSectionProps {
  className?: string;
}

export function ConnectedPlayersSection({
  className,
}: ConnectedPlayersSectionProps) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch } = useAdminConnectedPlayers(
    undefined,
    { refetchInterval: autoRefresh ? 5000 : false }
  );

  const totalCount = data?.total ?? 0;
  const registeredCount = data?.registeredCount ?? 0;
  const guestCount = data?.guestCount ?? 0;

  // Client-side filtering for fast responsive typing
  const filteredPlayers = useMemo(() => {
    const list = data?.players ?? [];
    return list.filter((player) => {
      // Filter by type tab
      if (filterType === "registered" && player.type !== "registered")
        return false;
      if (filterType === "guest" && player.type !== "guest") return false;

      // Filter by search query
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const username = player.user?.username?.toLowerCase() ?? "";
        const email = player.user?.email?.toLowerCase() ?? "";
        const guestName = player.guestName?.toLowerCase() ?? "";
        const ip = (player.ip ?? "").toLowerCase();
        const clientId = (player.clientId ?? "").toLowerCase();
        const roomName = player.room?.name.toLowerCase() ?? "";

        return (
          username.includes(query) ||
          email.includes(query) ||
          guestName.includes(query) ||
          ip.includes(query) ||
          clientId.includes(query) ||
          roomName.includes(query)
        );
      }

      return true;
    });
  }, [data?.players, filterType, search]);

  const filterOptions = [
    { value: "all" as const, label: `All (${totalCount})` },
    { value: "registered" as const, label: `Registered (${registeredCount})` },
    { value: "guest" as const, label: `Guests (${guestCount})` },
  ];

  return (
    <section
      aria-label="Connected players"
      className={cn("min-w-0", className)}
    >
      <Panel className="overflow-hidden text-ink">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl font-bold">
                Connected Players
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-900">
                <Radio size={16} aria-hidden="true" />
                {totalCount} Online
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {registeredCount} registered · {guestCount}{" "}
              {guestCount === 1 ? "guest" : "guests"} · Current server
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={autoRefresh}
              title={
                autoRefresh ? "Auto-refresh active (5s)" : "Auto-refresh paused"
              }
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  autoRefresh ? "bg-emerald-700" : "bg-ink-soft"
                )}
                aria-hidden="true"
              />
              {autoRefresh ? "Live (5s)" : "Paused"}
            </Button>
            <Tooltip content="Refresh now">
              <IconButton
                aria-label="Refresh connected players"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw
                  size={16}
                  className={isFetching ? "animate-spin" : ""}
                />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-ink/15 bg-slate-50 px-5 py-4">
          <div
            role="group"
            aria-label="Filter connected players"
            className="flex flex-wrap gap-1 rounded-xl border border-ink/20 bg-white p-1"
          >
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filterType === option.value}
                onClick={() => setFilterType(option.value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  filterType === option.value
                    ? "bg-ink text-white"
                    : "text-ink-soft hover:bg-slate-100"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-80">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players, IP or room…"
              aria-label="Search connected players"
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div
            className="p-8 text-center text-base text-ink-soft"
            role="status"
          >
            Loading connected players…
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-8 text-center text-base text-ink-soft">
            {totalCount === 0
              ? "No players currently connected to the server."
              : "No connected players match your search filter."}
          </div>
        ) : (
          <ul
            aria-label="Connected player list"
            className="divide-y divide-ink/15"
          >
            {filteredPlayers.map((player) => (
              <ConnectedPlayerRow
                key={player.socketId}
                player={player}
                onSelectUser={setSelectedUserId}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* User profile detail modal */}
      {selectedUserId !== null && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </section>
  );
}

interface ConnectedPlayerRowProps {
  player: AdminConnectedPlayer;
  onSelectUser: (userId: number) => void;
}

function ConnectedPlayerRow({ player, onSelectUser }: ConnectedPlayerRowProps) {
  const isRegistered = player.type === "registered";
  const connectedDate = new Date(player.connectedAt);

  return (
    <li className="p-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isRegistered
                ? "bg-sky-100 text-sky-900"
                : "bg-amber-100 text-amber-900"
            )}
          >
            {isRegistered ? <User size={20} /> : <Gamepad2 size={20} />}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {isRegistered ? (
                <button
                  type="button"
                  onClick={() => player.user && onSelectUser(player.user.id)}
                  className="break-all text-left text-base font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  title="View user profile"
                >
                  {player.user?.username}
                </button>
              ) : (
                <span className="break-all text-base font-semibold">
                  {player.guestName || "Guest (Unnamed)"}
                </span>
              )}
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-sm font-medium",
                  isRegistered
                    ? "bg-sky-100 text-sky-900"
                    : "bg-amber-100 text-amber-900"
                )}
              >
                {isRegistered ? "Registered" : "Guest"}
              </span>
              {player.user?.isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-sm font-medium text-purple-900">
                  <ShieldCheck size={14} /> Admin
                </span>
              )}
            </div>
            <p className="break-all text-sm text-ink-soft">
              {isRegistered ? player.user?.email : "Guest session"}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-1 text-sm">
          {player.room ? (
            <>
              <p className="break-words text-base font-semibold">
                {player.room.name}
              </p>
              <p className="text-ink-soft">
                {player.status === "playing" ? "Playing in" : "In Room"} #
                {player.room.id} · {player.room.mode ?? "ffa"}
              </p>
            </>
          ) : (
            <p className="text-base font-semibold">Main Lobby</p>
          )}
          <p
            className="flex items-center gap-1.5 text-ink-soft"
            title={connectedDate.toISOString()}
          >
            <Clock size={15} aria-hidden="true" />
            Connected for {formatDurationMs(player.durationMs)}
          </p>
        </div>

        {isRegistered && player.user && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start lg:justify-self-end"
            onClick={() => onSelectUser(player.user!.id)}
            title="Inspect user details"
          >
            <Eye size={16} /> Inspect
          </Button>
        )}
      </div>
      <details className="mt-4 rounded-lg border border-ink/15 bg-slate-50 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Connection details
        </summary>
        <dl className="grid gap-3 border-t border-ink/15 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["IP address", player.ip || "Not available"],
            ["Socket ID", player.socketId],
            ["Client ID", player.clientId || "Not available"],
            ["Connected since", connectedDate.toLocaleString()],
            ...(player.user ? [["User ID", String(player.user.id)]] : []),
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="mb-1 text-ink-soft">{label}</dt>
              <dd className="break-all font-mono text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
