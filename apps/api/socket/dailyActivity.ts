// In-memory gate + persistence trigger for daily-active-user tracking.
// Every socket connection (guest or authenticated player) is recorded once per
// UTC calendar day.
//
// To prevent redundant database queries on repeated reconnects or heartbeat
// pings within the same day, successful visits are memoized in an in-memory Set
// that automatically rolls over when the UTC date changes.
//
// Concurrent visits for the same client (e.g. initial guest handshake vs quick
// authenticate event) are serialized per clientId so guest tracking and
// registered upgrade cannot race.
import * as dailyActivityRepo from "../repositories/dailyActivity.repo";
import type { AppSocket } from "./types";

let currentDay = new Date().toISOString().slice(0, 10);
const visitedToday = new Set<string>();
const registeredClientsToday = new Set<string>();
const ongoingVisits = new Map<string, Promise<void>>();

// Get the current UTC day (YYYY-MM-DD), resetting the cache when the day rolls over.
function getUtcDay(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    visitedToday.clear();
    registeredClientsToday.clear();
  }
  return currentDay;
}

async function doRecordVisit(
  socket: AppSocket,
  user?: { playerId: number } | null,
  clientId: string = socket.data.clientId || socket.id
): Promise<void> {
  const day = getUtcDay();

  if (user && user.playerId) {
    const playerKey = `p:${user.playerId}`;
    const visitKey = `${day}:${playerKey}`;

    if (clientId) {
      registeredClientsToday.add(`${day}:${clientId}`);
      visitedToday.delete(`${day}:c:${clientId}`);
      try {
        await dailyActivityRepo.upgradeGuestToPlayer({
          day,
          guestKey: `c:${clientId}`,
          playerKey,
          playerId: user.playerId,
        });
        visitedToday.add(visitKey);
        return;
      } catch (err) {
        console.error("Failed to upgrade guest to player:", err);
      }
    }

    if (visitedToday.has(visitKey)) return;

    try {
      await dailyActivityRepo.upsertVisitor({
        day,
        visitorKey: playerKey,
        playerId: user.playerId,
      });
      visitedToday.add(visitKey);
    } catch (err) {
      console.error("Failed to upsert player visitor row:", err);
    }
  } else {
    // If this client was already authenticated as a registered player today,
    // do not create a guest row for it.
    if (clientId && registeredClientsToday.has(`${day}:${clientId}`)) return;

    const guestKey = `c:${clientId}`;
    const visitKey = `${day}:${guestKey}`;

    if (visitedToday.has(visitKey)) return;

    try {
      await dailyActivityRepo.upsertVisitor({
        day,
        visitorKey: guestKey,
        playerId: null,
      });
      visitedToday.add(visitKey);
    } catch (err) {
      console.error("Failed to upsert guest visitor row:", err);
    }
  }
}

// Record an active visit for the current socket, serialized per client identity.
async function recordVisit(
  socket: AppSocket,
  user?: { playerId: number } | null
): Promise<void> {
  const clientId = socket.data.clientId || socket.id;
  const previous = ongoingVisits.get(clientId) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => doRecordVisit(socket, user, clientId));

  ongoingVisits.set(clientId, current);
  try {
    await current;
  } finally {
    if (ongoingVisits.get(clientId) === current) {
      ongoingVisits.delete(clientId);
    }
  }
}

function __resetForTests(): void {
  currentDay = new Date().toISOString().slice(0, 10);
  visitedToday.clear();
  registeredClientsToday.clear();
  ongoingVisits.clear();
}

export { recordVisit, __resetForTests, getUtcDay };
