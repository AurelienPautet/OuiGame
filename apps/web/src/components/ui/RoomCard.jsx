import { Users, Lock } from "lucide-react";

/**
 * RoomCard - Displays a room preview card with details
 *
 * @param {Object} props
 * @param {Object} props.room - Room data
 * @param {Function} props.onClick - Click handler
 */
export function RoomCard({ room, onClick }) {
  const { id, name, creator, players, maxPlayers, hasPassword } = room;
  const isFull = players >= maxPlayers;

  return (
    <div
      className={`
        relative flex gap-4 p-4 rounded-lg cursor-pointer
        transition-all duration-200
        bg-base-300
        border-4 border-base-300
        hover:bg-base-200
        ${isFull ? "opacity-70" : ""}
      `}
      onClick={isFull ? undefined : onClick}
    >
      {/* Full overlay */}
      {isFull && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/30 rounded-lg">
          <span className="text-white text-xl font-bold flex items-center gap-2">
            FULL
          </span>
        </div>
      )}

      {/* Content */}
      <div
        className={`flex-1 flex flex-col justify-between ${
          isFull ? "blur-sm" : ""
        }`}
      >
        {/* Title row */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h3
              className="text-lg font-bold truncate max-w-[200px]"
              title={name}
            >
              {name}
            </h3>
            <span className="text-base-content/60 text-sm">by {creator}</span>
          </div>

          <div className="flex gap-2">
            {hasPassword && (
              <div
                className="tooltip tooltip-left"
                data-tip="Password Protected"
              >
                <Lock className="w-5 h-5 text-warning" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex justify-between items-end mt-2">
          <div className="flex items-center gap-2">
            <div
              className={`badge badge-lg gap-1 ${
                isFull ? "badge-error" : "badge-neutral"
              }`}
            >
              <Users className="w-4 h-4" />
              {players}/{maxPlayers}
            </div>
            <div className="text-xs text-base-content/40 font-mono">#{id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
