import { Users, Lock } from "lucide-react";
import type { RoomSummary } from "@ouigame/shared/api";
import { Tooltip } from "./primitives";
import { cn } from "../../lib/cn";

// The in-memory room summary plus the optional password flag the card displays.
type Room = RoomSummary & { hasPassword?: boolean };

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

/** Arcade room preview card. */
export function RoomCard({ room, onClick }: RoomCardProps) {
  const { id, name, creator, players, maxPlayers, hasPassword } = room;
  const isFull = players >= maxPlayers;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 p-4 rounded-xl cursor-pointer transition-all duration-150 bg-white border-[3px] border-ink shadow-[0_4px_0_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
        isFull && "opacity-80 hover:translate-y-0"
      )}
      onClick={isFull ? undefined : onClick}
    >
      {isFull && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 rounded-xl">
          <span className="text-white text-lg font-bold">FULL</span>
        </div>
      )}

      <div
        className={cn(
          "flex justify-between items-start gap-2",
          isFull && "blur-sm"
        )}
      >
        <div className="flex flex-col min-w-0">
          <h3 className="text-lg font-bold text-ink truncate" title={name}>
            {name}
          </h3>
          <span className="text-blue-d text-sm font-semibold truncate">
            by {creator}
          </span>
        </div>
        {hasPassword && (
          <Tooltip content="Password protected" side="left">
            <Lock className="text-yellow-d" size={20} />
          </Tooltip>
        )}
      </div>

      <div
        className={cn("flex justify-between items-center", isFull && "blur-sm")}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-bold text-sm border-[3px] border-ink rounded-lg px-2.5 py-1",
            isFull ? "bg-red text-white" : "bg-field text-ink"
          )}
        >
          <Users size={16} />
          {players}/{maxPlayers}
        </span>
        <span className="text-xs text-ink-soft font-mono">#{id}</span>
      </div>
    </div>
  );
}
