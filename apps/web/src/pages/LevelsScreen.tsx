import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts";
import { LevelSelector } from "../components/ui";
import { IoTitle, SectionLabel } from "../components/ui/primitives";

/** Dedicated full-screen solo level browser (was the LEVEL_SELECTOR modal). */
export const LevelsScreen = () => {
  const navigate = useNavigate();
  const { startSoloGame } = useGame();

  const handleSelect = (levelId: number) => {
    startSoloGame(levelId);
    navigate("/");
  };

  return (
    <div className="pt-6">
      <div className="flex items-center gap-3.5 flex-wrap mb-4">
        <IoTitle as="h1" className="text-4xl">
          PLAY&nbsp;SOLO
        </IoTitle>
        <SectionLabel>community arenas</SectionLabel>
      </div>
      <div className="h-[calc(100vh-180px)] min-h-[420px]">
        <LevelSelector mode="solo" onSelect={handleSelect} />
      </div>
    </div>
  );
};
