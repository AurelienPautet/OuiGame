import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

/**
 * LivesHud - campaign-only overlay showing remaining lives and progress.
 * A floating dark pill (the StatPill motif used by the menu Topbar), so it
 * reads clearly over the light play field.
 */
interface LivesHudProps {
  /** remaining lives */
  lives: number;
  /** 1-based current level number */
  levelIndex: number;
  totalLevels: number;
  /** briefly emphasise after gaining a life */
  flash?: boolean;
}

export const LivesHud = ({
  lives,
  levelIndex,
  totalLevels,
  flash = false,
}: LivesHudProps) => {
  const { t } = useTranslation();
  // Render up to a reasonable number of hearts, then a numeric badge if more.
  const heartCount = Math.min(lives, 8);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-panel-dark/[0.86] border-[3px] border-ink rounded-full px-5 py-2 text-white pointer-events-none">
      <span className="font-bold text-sm tracking-wide">
        {t("livesHud.level", { current: levelIndex, total: totalLevels })}
      </span>
      <div
        className={`flex items-center gap-1 transition-transform duration-300 ${
          flash ? "scale-125" : "scale-100"
        }`}
      >
        {Array.from({ length: heartCount }).map((_, i) => (
          <Heart key={i} className="w-5 h-5 fill-red text-red" />
        ))}
        {lives > 8 && <span className="ml-1 font-bold text-red">x{lives}</span>}
        {lives === 0 && <span className="font-bold text-red/70">0</span>}
      </div>
    </div>
  );
};
