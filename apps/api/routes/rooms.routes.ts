import express from "express";
import type { Request, Response } from "express";
const router = express.Router();

// Fields read off each room when listing. The full room objects live in the
// socket layer; only this subset is surfaced over HTTP.
type RoomListEntry = {
  id: number;
  name: string;
  creator: string;
  players: Record<string, unknown>;
  maxplayernb: number;
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
    players: Object.keys(room.players).length,
    maxPlayers: room.maxplayernb,
  }));

  res.json(roomList);
});

export default router;
export { setRoomsRef };
