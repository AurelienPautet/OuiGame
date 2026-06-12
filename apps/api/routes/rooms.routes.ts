import express from "express";
import type { Request, Response } from "express";
const router = express.Router();

// Fields read off each room when listing. The full room objects live in the
// socket layer; only this subset is surfaced over HTTP. status/mode/
// human_count are optional so legacy stubs (tests) without them still list.
type RoomListEntry = {
  id: number;
  name: string;
  creator: string;
  players: Record<string, unknown>;
  maxplayernb: number;
  status?: "lobby" | "playing";
  mode?: "ffa" | "coop";
  human_count?: () => number;
};

let rooms: Record<number, unknown> = {};

function setRoomsRef(roomsObj: Record<number, unknown>) {
  rooms = roomsObj;
}

// GET /api/rooms
router.get("/", (req: Request, res: Response) => {
  const roomList = (Object.values(rooms) as RoomListEntry[]).map((room) => ({
    id: room.id,
    name: room.name,
    creator: room.creator,
    // Coop capacity is humans-only (level bots don't take seats); ffa counts
    // every combatant (a lobby bot holds a real spawn slot).
    players:
      room.mode === "coop" && room.human_count
        ? room.human_count()
        : Object.keys(room.players).length,
    maxPlayers: room.maxplayernb,
    ...(room.status !== undefined && { status: room.status }),
    ...(room.mode !== undefined && { mode: room.mode }),
  }));

  res.json(roomList);
});

export default router;
export { setRoomsRef };
