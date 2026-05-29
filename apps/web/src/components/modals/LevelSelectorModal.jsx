import { useModal, useGame } from "../../contexts";
import { LevelSelector } from "../ui";

export const LevelSelectorModal = () => {
  const { closeModal } = useModal();
  const { startSoloGame } = useGame();

  const handleSelect = (levelId) => {
    startSoloGame(levelId);
    closeModal();
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-4xl h-3/4 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Select Level</h2>

        <div className="flex-1 min-h-0">
          <LevelSelector mode="solo" onSelect={handleSelect} />
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
