import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { cn } from "../../../lib/cn";

interface SectionCardProps {
  icon?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Inner panel section used for scoreboards / leaderboards — the light tile motif
 * shared with `Stat`, with an optional small header.
 */
export function SectionCard({
  icon,
  title,
  children,
  className,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "w-full bg-ink/[0.04] border-2 border-ink rounded-lg p-3",
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-2 text-sm font-bold text-ink">
          {icon}
          {title}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Medal colour for a leaderboard rank (readable on the white card). */
function rankColor(rank: number): string {
  if (rank === 1) return "text-yellow-d";
  if (rank === 2) return "text-ink/40";
  if (rank === 3) return "text-orange";
  return "text-ink/50";
}

interface ScoreRowProps {
  name: string;
  wins: number;
  kills: number;
  deaths: number;
  isWinner?: boolean;
  hasHighestKills?: boolean;
  hasHighestDeaths?: boolean;
}

/** One row of the multiplayer post-round score table. */
export function ScoreRow({
  name,
  wins,
  kills,
  deaths,
  isWinner = false,
  hasHighestKills = false,
  hasHighestDeaths = false,
}: ScoreRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm px-2 py-1 rounded",
        isWinner && "bg-yellow/25"
      )}
    >
      <span className="font-bold truncate text-ink">{name}</span>
      <span className="flex items-center gap-3 tabular-nums shrink-0 font-bold">
        <span className="text-ink">{wins}W</span>
        <span className={hasHighestKills ? "text-green-d" : "text-ink/60"}>
          {kills}K
        </span>
        <span className={hasHighestDeaths ? "text-red-d" : "text-ink/60"}>
          {deaths}D
        </span>
      </span>
    </div>
  );
}

interface LeaderRowProps {
  rank: number;
  username: string;
  /** Pre-formatted time string. */
  time: string;
  isMe?: boolean;
}

/** One row of the solo best-times leaderboard. */
export function LeaderRow({
  rank,
  username,
  time,
  isMe = false,
}: LeaderRowProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm px-2 py-1 rounded text-ink",
        isMe && "bg-blue/15"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "w-5 text-center font-bold tabular-nums",
            rankColor(rank)
          )}
        >
          {rank}
        </span>
        <User className="w-4 h-4 shrink-0" />
        <span className="truncate">{username}</span>
        {isMe && (
          <span className="text-xs text-ink/50">{t("common.youParens")}</span>
        )}
      </div>
      <span className="font-bold tabular-nums text-ink">{time}</span>
    </div>
  );
}
