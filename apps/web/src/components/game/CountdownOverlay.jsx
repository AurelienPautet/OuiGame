import { useState, useEffect } from "react";

/**
 * CountdownOverlay - Displays a 3-2-1-GO countdown before game starts
 * Smaller and more subtle design
 */
export const CountdownOverlay = ({ isActive, onComplete }) => {
  const [count, setCount] = useState(3);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setCount(3);

      const timer = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Short delay before hiding and triggering complete
            setTimeout(() => {
              setVisible(false);
              onComplete?.();
            }, 500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isActive, onComplete]);

  if (!visible) return null;

  const displayText = count === 0 ? "GO!" : count.toString();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-white/60 bg-black/40"
        style={{
          animation: "countdownPop 0.3s ease-out",
        }}
      >
        <span
          className="text-5xl font-bold text-white"
          key={count}
          style={{
            animation: "countdownScale 0.3s ease-out",
          }}
        >
          {displayText}
        </span>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes countdownPop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes countdownScale {
          0% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
