const express = require("express");
const router = express.Router();

let rooms = {};

function setRoomsRef(roomsObj) {
  rooms = roomsObj;
}

// GET /api/rooms
router.get("/", (req, res) => {
  const roomList = Object.values(rooms).map((room) => ({
    id: room.id,
    name: room.name,
    creator: room.creator,
    players: Object.keys(room.players).length,
    maxPlayers: room.maxplayernb,
  }));

  res.json(roomList);
});

module.exports = router;
module.exports.setRoomsRef = setRoomsRef;
