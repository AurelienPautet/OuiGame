import { useNavigate } from "react-router-dom";
import { useModal, useAuth } from "../../contexts";
import { CampaignSelector } from "../ui";
import { useDeleteCampaign } from "../../hooks/api";

export const MyCampaignsModal = () => {
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { user } = useAuth();
  const deleteCampaign = useDeleteCampaign();

  const handleEdit = (campaignId: number) => {
    closeModal();
    navigate(`/campaign-editor?id=${campaignId}`);
  };

  const handleDelete = (campaignId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this campaign? This cannot be undone."
      )
    ) {
      deleteCampaign.mutate(campaignId);
    }
  };

  const handleCreate = () => {
    closeModal();
    navigate("/campaign-editor");
  };

  if (!user) {
    return (
      <dialog className="modal modal-open">
        <div className="modal-box bg-base-100">
          <h2 className="text-2xl font-bold mb-4">Your Campaigns</h2>
          <p className="text-base-content/70">
            Please log in to create and manage campaigns.
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
        <h2 className="text-2xl font-bold mb-4">Your Campaigns</h2>

        <div className="flex-1 min-h-0">
          <CampaignSelector
            mode="my"
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
