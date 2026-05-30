import { useSocket } from "../../contexts";

const OnlineIndicator = () => {
  const { onlineCount, isConnected } = useSocket();

  return (
    <div className="absolute top-4 right-4 z-50">
      <div
        className={`
          flex items-center gap-3 px-4 py-2.5
          rounded-xl backdrop-blur-md 
          border border-white/5 shadow-lg
          transition-all duration-300
          ${isConnected ? "bg-base-100/80 hover:bg-base-100/90" : "bg-error/20 border-error/30"}
        `}
      >
        {/* Status Indicator */}
        <div className="relative flex items-center justify-center">
          <div
            className={`
              w-2.5 h-2.5 rounded-full 
              ${isConnected ? "bg-success shadow-[0_0_8px_oklch(var(--success)/0.6)]" : "bg-error shadow-[0_0_8px_oklch(var(--error)/0.6)]"}
            `}
          />
          {isConnected && (
            <div className="absolute inset-0 w-full h-full rounded-full bg-success/40 animate-ping" />
          )}
        </div>

        {/* Player Count */}
        <div className="flex items-center gap-2">
          <span className="text-base-content font-bold text-sm tracking-wide">
            {onlineCount}
          </span>
          <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">
            Online
          </span>
        </div>
      </div>
    </div>
  );
};

export default OnlineIndicator;
