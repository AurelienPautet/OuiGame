import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useModal } from "../../contexts";
import { TANK_COLORS as COLORS } from "../../constants/tankColors";
import { storage } from "../../lib/storage";

export const TankSelectModal = () => {
  const { closeModal } = useModal();

  // Load saved colors from storage or default to index 1 (orange)
  const [bodyIndex, setBodyIndex] = useState(() => {
    const saved = storage.getBodyIndex();
    const idx = saved ?? 1;
    return Math.max(0, Math.min(idx, COLORS.length - 1));
  });
  const [turretIndex, setTurretIndex] = useState(() => {
    const saved = storage.getTurretIndex();
    const idx = saved ?? 1;
    return Math.max(0, Math.min(idx, COLORS.length - 1));
  });

  // Navigate to previous/next
  const navigateTurret = (direction: number) => {
    setTurretIndex((prev) =>
      Math.max(0, Math.min(prev + direction, COLORS.length - 1))
    );
  };

  const navigateBody = (direction: number) => {
    setBodyIndex((prev) =>
      Math.max(0, Math.min(prev + direction, COLORS.length - 1))
    );
  };

  // Handle click on carousel - left half goes prev, right half goes next
  const handleCarouselClick = (
    e: React.MouseEvent<HTMLDivElement>,
    navigateFn: (direction: number) => void
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;
    navigateFn(isLeftHalf ? -1 : 1);
  };

  const handleSave = () => {
    storage.setTankColors(
      bodyIndex,
      turretIndex,
      COLORS[bodyIndex],
      COLORS[turretIndex]
    );
    closeModal();
  };

  // Render a single carousel strip
  const renderCarousel = (
    items: string[],
    selectedIndex: number,
    navigate: (direction: number) => void,
    type: string
  ) => (
    <div className="relative h-full">
      {/* Left Arrow */}
      <button
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 btn btn-circle btn-ghost btn-sm
          ${selectedIndex === 0 ? "invisible" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          navigate(-1);
        }}
      >
        <ChevronLeft className="w-8 h-8 text-primary" />
      </button>

      {/* Clickable carousel area */}
      <div
        className="flex items-center justify-center h-full cursor-pointer"
        onClick={(e) => handleCarouselClick(e, navigate)}
      >
        {/* Show prev, current, next items */}
        <div className="flex items-center justify-center gap-4">
          {/* Previous item (faded) */}
          <div className="w-32 h-20 opacity-40 transition-all duration-200">
            {selectedIndex > 0 && (
              <img
                src={`ressources/image/tank_player/${type}_${
                  items[selectedIndex - 1]
                }.png`}
                alt={`${type} ${items[selectedIndex - 1]}`}
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            )}
          </div>

          {/* Current item (large and centered) */}
          <div
            className={`${
              type === "turret" ? "w-48 h-28" : "w-44 h-36"
            } transition-all duration-200`}
          >
            <img
              src={`ressources/image/tank_player/${type}_${items[selectedIndex]}.png`}
              alt={`${type} ${items[selectedIndex]}`}
              className="w-full h-full object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Next item (faded) */}
          <div className="w-32 h-20 opacity-40 transition-all duration-200">
            {selectedIndex < items.length - 1 && (
              <img
                src={`ressources/image/tank_player/${type}_${
                  items[selectedIndex + 1]
                }.png`}
                alt={`${type} ${items[selectedIndex + 1]}`}
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Arrow */}
      <button
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 btn btn-circle btn-ghost btn-sm
          ${selectedIndex === items.length - 1 ? "invisible" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          navigate(1);
        }}
      >
        <ChevronRight className="w-8 h-8 text-primary" />
      </button>
    </div>
  );

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-2xl p-0 overflow-hidden">
        {/* Turret Selector */}
        <div className="h-44 bg-base-200">
          {renderCarousel(COLORS, turretIndex, navigateTurret, "turret")}
        </div>

        {/* Body Selector */}
        <div className="h-48 bg-base-200 border-t border-base-300">
          {renderCarousel(COLORS, bodyIndex, navigateBody, "body")}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 p-4 bg-base-200 border-t border-base-300">
          <button className="btn" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  );
};
