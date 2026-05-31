import { useModal, useGame } from "../../contexts";
import { LevelSelector } from "../ui";
import { Dialog, DialogContent, DialogTitle } from "../ui/primitives";

// Kept for the in-game "play another solo level" flow (GameCanvas). The menu
// entry point is the dedicated /levels screen.
export const LevelSelectorModal = () => {
  const { closeModal } = useModal();
  const { startSoloGame } = useGame();

  const handleSelect = (levelId: number) => {
    startSoloGame(levelId);
    closeModal();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent
        widthClassName="w-[min(94vw,920px)]"
        className="h-[82vh] flex flex-col overflow-hidden"
      >
        <DialogTitle className="text-2xl font-bold mb-4">
          Select Level
        </DialogTitle>
        <div className="flex-1 min-h-0">
          <LevelSelector mode="solo" onSelect={handleSelect} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
