import { Users, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoomSummary } from "@ouigame/shared/api";
import { Card, Tooltip } from "./primitives";
import { cn } from "../../lib/cn";

// The in-memory room summary plus the optional password flag the card displays.
type Room = RoomSummary & { hasPassword?: boolean };

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

/** Arcade room preview card. */
export function RoomCard({ room, onClick }: RoomCardProps) {
  const { t } = useTranslation();
  const { id, name, creator, players, maxPlayers, hasPassword } = room;
  const isFull = players >= maxPlayers;

  return (
    <Card
      className={cn("flex flex-col gap-2 p-4", isFull && "opacity-80")}
      disabled={isFull}
      onClick={onClick}
    >
      {isFull && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 rounded-xl">
          <span className="text-white text-lg font-bold">
            {t("rooms.full")}
          </span>
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
            {t("common.by", { name: creator })}
          </span>
        </div>
        {hasPassword && (
          <Tooltip content={t("rooms.passwordProtected")} side="left">
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
    </Card>
  );
}
