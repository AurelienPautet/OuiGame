// In-memory gate + persistence trigger for daily-active-user tracking.
// Every socket connection (guest or authenticated player) is recorded once per
// UTC calendar day.
//
// To prevent redundant database queries on repeated reconnects or heartbeat
// pings within the same day, successful visits are memoized in an in-memory Set
// that automatically rolls over when the UTC date changes.
import * as dailyActivityRepo from "../repositories/dailyActivity.repo";
import type { AppSocket } from "./types";

let currentDay = new Date().toISOString().slice(0, 10);
const visitedToday = new Set<string>();

// Get the current UTC day (YYYY-MM-DD), resetting the cache when the day rolls over.
function getUtcDay(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    visitedToday.clear();
  }
  return currentDay;
}

// Record an active visit for the current socket.
// If `user` is provided, the visitor is recorded as a registered player ("p:<playerId>")
// and any preceding guest row ("c:<clientId>") for today is purged so the user is not
// counted twice.
// If `user` is null/undefined, the visitor is recorded as a guest ("c:<clientId>").
async function recordVisit(
  socket: AppSocket,
  user?: { playerId: number } | null
): Promise<void> {
  const day = getUtcDay();
  const clientId = socket.data.clientId || socket.id;

  if (user && user.playerId) {
    const playerKey = `p:${user.playerId}`;
    const visitKey = `${day}:${playerKey}`;

    // Clean up any guest entry for this client id today
    if (clientId) {
      const guestKey = `c:${clientId}`;
      visitedToday.delete(`${day}:${guestKey}`);
      try {
        await dailyActivityRepo.deleteVisitor(day, guestKey);
      } catch (err) {
        console.error("Failed to delete guest visitor row:", err);
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

function __resetForTests(): void {
  currentDay = new Date().toISOString().slice(0, 10);
  visitedToday.clear();
}

export { recordVisit, __resetForTests, getUtcDay };
