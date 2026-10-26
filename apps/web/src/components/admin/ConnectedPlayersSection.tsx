import { useState, useMemo } from "react";
import {
  Users,
  ShieldCheck,
  User,
  Radio,
  Gamepad2,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Globe,
  Wifi,
  Filter,
} from "lucide-react";
import type { AdminConnectedPlayer } from "@ouigame/shared/api";
import { useAdminConnectedPlayers } from "../../hooks/api";
import { formatDurationMs } from "../../lib/formatTime";
import {
  DarkPanel,
  Panel,
  Button,
  IconButton,
  Input,
  SegmentedControl,
  Tooltip,
} from "../ui/primitives";
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
    <div className={cn("space-y-4", className)}>
      {/* Header with live status, counts, and auto-refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper border-[3px] border-ink rounded-arcade p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-green/20 border-2 border-green text-green-700">
            <Radio size={18} className="animate-pulse" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-green border-2 border-paper" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-lg text-ink">
                Connected Players
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green/15 text-green-800 border border-green/30">
                {totalCount} Online
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-soft">
              Real-time socket connections tracked on this instance
            </p>
          </div>
        </div>

        {/* Counts Badges & Refresh controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="hidden md:flex items-center gap-2 text-xs font-bold mr-2">
            <span className="px-2.5 py-1 rounded-arcade bg-blue/10 border-2 border-blue/30 text-blue">
              {registeredCount} Reg
            </span>
            <span className="px-2.5 py-1 rounded-arcade bg-yellow/20 border-2 border-yellow/40 text-ink">
              {guestCount} {guestCount === 1 ? "Guest" : "Guests"}
            </span>
          </div>

          <Tooltip
            content={
              autoRefresh
                ? "Pause auto-refresh (5s)"
                : "Resume auto-refresh (5s)"
            }
          >
            <Button
              variant={autoRefresh ? "green" : "ghost"}
              size="sm"
              title={
                autoRefresh ? "Auto-refresh active (5s)" : "Auto-refresh paused"
              }
              onClick={() => setAutoRefresh((v) => !v)}
              className="text-xs gap-1.5"
            >
              <Wifi
                size={14}
                className={autoRefresh ? "text-green" : "text-ink-soft"}
              />
              {autoRefresh ? "● Live (5s)" : "○ Paused"}
            </Button>
          </Tooltip>

          <Tooltip content="Refresh now">
            <IconButton
              aria-label="Refresh connected players"
              size="sm"
              onClick={() => refetch()}
              className="p-1.5"
            >
              <RefreshCw
                size={14}
                className={isFetching ? "animate-spin" : ""}
              />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Filter and search toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SegmentedControl<FilterType>
          tone="yellow"
          value={filterType}
          onValueChange={setFilterType}
          options={filterOptions}
          aria-label="Filter connected players"
        />

        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, ID, IP, room…"
            aria-label="Search connected players"
            className="pl-9"
          />
        </div>
      </div>

      {/* Connected Players Table / List */}
      <DarkPanel className="overflow-hidden p-0 border-[3px] border-ink">
        {isLoading ? (
          <div className="p-8 text-center text-sm font-semibold text-ink-soft">
            <RefreshCw
              size={20}
              className="animate-spin mx-auto mb-2 text-ink-soft"
            />
            Loading connected players…
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-ink-soft">
            {totalCount === 0
              ? "No players currently connected to the server."
              : "No connected players match your search filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-ink/5 border-b-2 border-ink/20 text-xs font-display uppercase tracking-wider text-ink-soft">
                  <th className="py-2.5 px-4">Player</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status / Room</th>
                  <th className="py-2.5 px-3">Connected Time</th>
                  <th className="py-2.5 px-3">Connection Details</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filteredPlayers.map((player) => (
                  <ConnectedPlayerRow
                    key={player.socketId}
                    player={player}
                    onSelectUser={(id) => setSelectedUserId(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DarkPanel>

      {/* User profile detail modal */}
      {selectedUserId !== null && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
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
    <tr className="hover:bg-ink/5 transition-colors">
      {/* Player Identity */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center font-bold text-xs uppercase shrink-0",
              isRegistered
                ? "bg-blue/15 text-blue"
                : "bg-amber-100 text-amber-700"
            )}
          >
            {isRegistered ? <User size={16} /> : <Gamepad2 size={16} />}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-bold text-ink text-sm truncate">
                {isRegistered ? (
                  <button
                    type="button"
                    onClick={() => player.user && onSelectUser(player.user.id)}
                    className="hover:underline text-left cursor-pointer text-ink hover:text-blue-600 focus:outline-none"
                    title="View user profile"
                  >
                    {player.user?.username}
                  </button>
                ) : (
                  <span>{player.guestName || "Guest (Unnamed)"}</span>
                )}
              </span>

              {isRegistered && player.user?.isAdmin && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  <ShieldCheck size={10} />
                  Admin
                </span>
              )}
            </div>

            <span className="text-xs text-ink-soft truncate font-mono">
              {isRegistered ? (
                player.user?.email
              ) : (
                <span title={`Client ID: ${player.clientId || "N/A"}`}>
                  Client:{" "}
                  {player.clientId ? `${player.clientId.slice(0, 14)}…` : "N/A"}
                </span>
              )}
            </span>
          </div>
        </div>
      </td>

      {/* Account Type Badge */}
      <td className="py-3 px-3">
        {isRegistered ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue/15 text-blue border border-blue/30">
            <User size={12} />
            Registered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow/20 text-yellow-900 border border-yellow/40">
            <Gamepad2 size={12} />
            Guest
          </span>
        )}
      </td>

      {/* Current Room / Activity Status */}
      <td className="py-3 px-3">
        {player.room ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  player.status === "playing"
                    ? "bg-green animate-pulse"
                    : "bg-blue"
                )}
              />
              <span
                className="font-semibold text-xs text-ink truncate max-w-[140px]"
                title={player.room.name}
              >
                {player.status === "playing" ? "Playing in" : "In Room"} #
                {player.room.id}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-ink-soft uppercase font-medium">
              <span className="truncate max-w-[120px]">{player.room.name}</span>
              <span>·</span>
              <span>{player.room.mode ?? "ffa"}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <span className="w-2 h-2 rounded-full bg-ink/30" />
            <span>Main Lobby</span>
          </div>
        )}
      </td>

      {/* Connected Duration */}
      <td className="py-3 px-3">
        <div className="flex flex-col text-xs">
          <span className="font-bold text-ink flex items-center gap-1">
            <Clock size={12} className="text-ink-soft" />
            {formatDurationMs(player.durationMs)}
          </span>
          <span
            className="text-[11px] text-ink-soft font-mono"
            title={connectedDate.toISOString()}
          >
            {connectedDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </td>

      {/* Socket & IP details */}
      <td className="py-3 px-3">
        <div className="flex flex-col font-mono text-[11px] text-ink-soft">
          <span
            className="flex items-center gap-1"
            title={`Socket ID: ${player.socketId}`}
          >
            <span className="text-[10px] text-ink-soft/70 uppercase">
              Sock:
            </span>
            {player.socketId.slice(0, 10)}…
          </span>
          <span
            className="flex items-center gap-1"
            title={`IP Address: ${player.ip || "N/A"}`}
          >
            <Globe size={10} className="text-ink-soft/70" />
            {player.ip || "N/A"}
          </span>
        </div>
      </td>

      {/* Action: Open User Modal if registered */}
      <td className="py-3 px-3 text-right">
        {isRegistered && player.user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectUser(player.user!.id)}
            className="text-xs gap-1 py-1 px-2.5"
            title="Inspect user details"
          >
            <Eye size={13} />
            <span>Inspect</span>
          </Button>
        ) : (
          <span className="text-xs text-ink-soft/50 italic px-2">—</span>
        )}
      </td>
    </tr>
  );
}
