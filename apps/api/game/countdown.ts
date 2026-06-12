// The 3-2-1 round-start countdown, shared by the post-respawn flow (tickLoop)
// and the lobby's Start button (socket handlers): freeze input, tell the
// clients, unfreeze after countdownDuration. The timeout is tracked in the
// registry's roomTimers so room deletion can cancel it mid-count.
import type { Room } from "@ouigame/shared/game";

type RoomTimers = Map<
  number,
  { respawn?: NodeJS.Timeout; countdown?: NodeJS.Timeout }
>;

export function beginCountdown(room: Room, roomTimers: RoomTimers): void {
  room.countdownActive = true;
  // Socket.io rooms are STRING-keyed (players join String(room.id)). The
  // historical inline version broadcast to the numeric id — a different,
  // permanently empty channel — so clients never actually received the
  // between-rounds countdown_start. Server rooms always have a real io.
  room.io!.to(String(room.id)).emit("countdown_start", {
    duration: room.countdownDuration,
  });

  const countdown = setTimeout(() => {
    room.countdownActive = false;
  }, room.countdownDuration);
  const tracked = roomTimers.get(room.id) || {};
  tracked.countdown = countdown;
  roomTimers.set(room.id, tracked);
}
