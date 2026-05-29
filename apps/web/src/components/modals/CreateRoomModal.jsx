import { useState, useCallback, useEffect } from "react";
import { useModal, useSocket, useGame, useAuth } from "../../contexts";
import { LevelSelector } from "../ui";

export const CreateRoomModal = () => {
  const { closeModal } = useModal();
  const { socket } = useSocket();
  const { startOnlineGame } = useGame();
  const { user } = useAuth();
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [rounds, setRounds] = useState(10);
  const [isCreating, setIsCreating] = useState(false);

  const handleMultiSelect = useCallback((levelIds) => {
    setSelectedLevels(levelIds);
  }, []);

  // Listen for room creation success to auto-join
  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (roomId) => {
      setIsCreating(false);
      startOnlineGame(roomId);
      closeModal();
    };

    socket.on("room_created", handleRoomCreated);

    return () => {
      socket.off("room_created", handleRoomCreated);
    };
  }, [socket, startOnlineGame, closeModal]);

  const handleCreateRoom = () => {
    if (!roomName || selectedLevels.length === 0) return;
    if (!user) {
      alert("You must be logged in to create a room");
      return;
    }

    setIsCreating(true);
    // Server expects signature: (name, rounds, list_id, creator)
    socket.emit("new-room", roomName, rounds, selectedLevels, user.username);
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-4xl h-3/4 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Create Room</h2>

        {/* Room settings */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            className="input input-bordered flex-1 bg-base-200"
            placeholder="Room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          {/* Note: Server currently doesn't seem to support password in new-room event, but keeping UI for future */}
          <input
            type="password"
            className="input input-bordered w-32 bg-base-200"
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={true} // Disabled until server support confirmed
            title="Password protection coming soon"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm">Rounds:</span>
            <input
              type="number"
              className="input input-bordered w-20 bg-base-200"
              min={1}
              max={99}
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Level selector */}
        <div className="flex-1 min-h-0">
          <LevelSelector mode="room" onMultiSelect={handleMultiSelect} />
        </div>

        <div className="modal-action">
          <button className="btn" onClick={closeModal} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!roomName || selectedLevels.length === 0 || isCreating}
            onClick={handleCreateRoom}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner text-white"></span>
                Creating...
              </>
            ) : (
              `Create Room (${selectedLevels.length} levels)`
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal} disabled={isCreating}>
          close
        </button>
      </form>
    </dialog>
  );
};
