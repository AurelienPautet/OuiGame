import { useNavigate } from "react-router-dom";
import { useModal, useAuth } from "../../contexts";
import { LevelSelector } from "../ui";
import { useDeleteLevel } from "../../hooks/api";

export const MyLevelsModal = () => {
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { user } = useAuth();
  const deleteLevel = useDeleteLevel();

  const handleEdit = (levelId) => {
    closeModal();
    navigate(`/editor?id=${levelId}`);
  };

  const handleDelete = (levelId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this level? This cannot be undone."
      )
    ) {
      deleteLevel.mutate(levelId);
    }
  };

  const handleCreate = () => {
    closeModal();
    navigate("/editor");
  };

  if (!user) {
    return (
      <dialog className="modal modal-open">
        <div className="modal-box bg-base-100">
          <h2 className="text-2xl font-bold mb-4">Your Levels</h2>
          <p className="text-base-content/70">
            Please log in to view your levels.
          </p>
          <div className="modal-action">
            <button className="btn" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeModal}>close</button>
        </form>
      </dialog>
    );
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-4xl h-3/4 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Your Levels</h2>

        <div className="flex-1 min-h-0">
          <LevelSelector
            mode="myLevels"
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        </div>

        <div className="modal-action">
          <button className="btn" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  );
};
