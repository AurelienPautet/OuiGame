import { useTranslation } from "react-i18next";
import { Crown, Plus, Play, X } from "lucide-react";
import { useSocket } from "../../contexts";
import { OverlayPanel } from "./overlay";
import { Button, TankAvatar } from "../ui/primitives";
import type { LobbyState } from "@ouigame/shared/types";

// The pre-game lobby panel, shown over the LIVE (frozen) arena while the
// room's status is "lobby". Purely presentational + emits: the lobby_state
// subscription lives in GameCanvas (which owns overlay visibility), and the
// server is the authority on every action — non-host emits are silently
// ignored there, the buttons here are just honest about it.
//
// No scrim on purpose: the arena behind stays visible (tanks pop in as people
// join, an added bot rolls onto the field immediately). Clicks on the panel
// can't fire a shot — the server drops input while the room is frozen.

interface LobbyOverlayProps {
  state: LobbyState;
  roomId: number | string;
  onLeave: () => void;
}

export const LobbyOverlay = ({ state, roomId, onLeave }: LobbyOverlayProps) => {
  const { t } = useTranslation();
  const { socket } = useSocket();

  if (state.status !== "lobby") return null;

  const me = state.members.find((m) => m.socketid === socket?.id);
  const isHost = me?.is_host === true;
  const humanCount = state.members.filter((m) => !m.is_bot).length;
  // Coop capacity counts humans (the level brings the bots); ffa counts every
  // combatant (a bot holds a real seat).
  const seatCount = state.mode === "coop" ? humanCount : state.members.length;
  const isCoop = state.mode === "coop";
  const canStart = isCoop ? humanCount >= 1 : state.members.length >= 2;
  const canAddBot = !isCoop && state.members.length < state.max_players;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <OverlayPanel
        className="pointer-events-auto"
        widthClassName="w-[26rem] max-w-[92%]"
        title={state.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-bold uppercase text-xs border-2 border-ink rounded-md px-1.5 py-0.5 bg-field">
              {isCoop ? t("lobby.coop") : t("lobby.classic")}
            </span>
            <span>
              {seatCount}/{state.max_players}
            </span>
          </span>
        }
        footer={
          <div className="flex flex-col items-stretch gap-2 w-full">
            {isHost ? (
              <>
                {!isCoop && (
                  <Button
                    variant="blue"
                    disabled={!canAddBot}
                    onClick={() => socket?.emit("lobby_add_bot", roomId)}
                  >
                    <Plus size={18} /> {t("lobby.addBot")}
                  </Button>
                )}
                <Button
                  variant="green"
                  disabled={!canStart}
                  onClick={() => socket?.emit("lobby_start", roomId)}
                >
                  <Play size={18} /> {t("lobby.start")}
                </Button>
              </>
            ) : (
              <p className="text-center text-ink-soft font-semibold text-sm">
                {t("lobby.waitingForHost")}
              </p>
            )}
            <Button variant="ghost" onClick={onLeave}>
              {t("lobby.leave")}
            </Button>
          </div>
        }
      >
        <ul className="w-full flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {state.members.map((m) => (
            <li
              key={m.socketid}
              className="flex items-center gap-3 bg-field border-2 border-ink/20 rounded-lg px-3 py-1.5"
            >
              <TankAvatar
                bodyColor={m.bodyc}
                turretColor={m.turretc}
                size={28}
                title={m.name}
              />
              <span className="flex-1 font-semibold truncate">{m.name}</span>
              {m.is_bot && (
                <span className="text-[10px] font-bold uppercase border-2 border-ink/40 rounded px-1 py-0.5 text-ink-soft">
                  {t("lobby.bot")}
                </span>
              )}
              {m.is_host && (
                <Crown
                  size={16}
                  className="text-yellow-d"
                  aria-label={t("lobby.host")}
                />
              )}
              {isHost && m.is_bot && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("lobby.removeBot")}
                  onClick={() =>
                    socket?.emit("lobby_remove_bot", roomId, m.socketid)
                  }
                >
                  <X size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </OverlayPanel>
    </div>
  );
};
