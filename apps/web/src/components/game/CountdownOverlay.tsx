import { useState, useEffect } from "react";

/**
 * CountdownOverlay - Displays a 3-2-1-GO countdown before game starts.
 * Arcade badge: ink-outlined dark disc with an outlined (io-title) number, so
 * it matches the rest of the overlay design system.
 */
interface CountdownOverlayProps {
  isActive: boolean;
  onComplete?: () => void;
}

export const CountdownOverlay = ({
  isActive,
  onComplete,
}: CountdownOverlayProps) => {
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
    return undefined;
  }, [isActive, onComplete]);

  if (!visible) return null;

  const displayText = count === 0 ? "GO!" : count.toString();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex items-center justify-center size-28 rounded-full border-4 border-ink bg-panel-dark/[0.92] shadow-arcade backdrop-blur-sm animate-[countdownPop_0.3s_ease-out]">
        <span
          key={count}
          className="io-title font-display text-5xl animate-[countdownScale_0.3s_ease-out]"
        >
          {displayText}
        </span>
      </div>
    </div>
  );
};
