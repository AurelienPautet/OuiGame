import { useState } from "react";
import { Search, Plus, RefreshCw, Gamepad2 } from "lucide-react";
import { useModal, useGame, MODALS } from "../../contexts";
import { RoomCard } from "../ui/RoomCard";
import { useRooms } from "../../hooks/api";
import type { RoomSummary } from "@ouigame/shared/api";

export const RoomSelectorModal = () => {
  const { closeModal, openModal } = useModal();
  const { startOnlineGame } = useGame();
  const [searchName, setSearchName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);

  // Use React Query for fetching rooms
  const { data: roomsData = [], isLoading, refetch } = useRooms();

  // Transform data if needed (API returns objects, not arrays)
  const rooms = roomsData;

  const handleRefresh = () => {
    refetch();
  };

  // Filter rooms based on search
  const filteredRooms = rooms.filter((room: RoomSummary) => {
    const nameMatch = room.name
      .toLowerCase()
      .includes(searchName.toLowerCase());
    const playerMatch = maxPlayers === 0 || room.maxPlayers === maxPlayers;
    return nameMatch && playerMatch;
  });

  const handleJoinRoom = (roomId: RoomSummary["id"]) => {
    startOnlineGame(roomId);
    closeModal();
  };

  const handleCreateRoom = () => {
    openModal(MODALS.CREATE_ROOM);
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-3xl h-3/4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Play Online</h2>
          <button
            className="btn btn-sm btn-ghost gap-1"
            onClick={handleRefresh}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <label className="input input-bordered flex items-center gap-2 flex-1 bg-base-200">
            <Search className="w-4 h-4 opacity-70" />
            <input
              type="text"
              className="grow bg-transparent"
              placeholder="Search room name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </label>
          <select
            className="select select-bordered bg-base-200"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
          >
            <option value={0}>Any players</option>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {/* Create Room Button */}
          <div
            className="flex items-center gap-4 p-4 rounded-lg bg-base-300 border-4 border-base-300 hover:bg-base-200 cursor-pointer transition-colors"
            onClick={handleCreateRoom}
          >
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Create a New Room</h3>
              <p className="text-base-content/60">Public or Private Room</p>
            </div>
          </div>

          {isLoading && rooms.length === 0 ? (
            <div className="text-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="mt-2 text-base-content/60">Loading rooms...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No rooms available</p>
              <p className="text-sm mt-1">Create one to get started!</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => handleJoinRoom(room.id)}
              />
            ))
          )}
        </div>

        <div className="modal-action">
          <button className="btn" onClick={closeModal}>
            Cancel
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  );
};
