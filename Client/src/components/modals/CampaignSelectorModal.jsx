import { useState } from "react";
import { useModal, useGame, useToast } from "../../contexts";
import { CampaignSelector } from "../ui";
import { campaignsApi } from "../../api";

export const CampaignSelectorModal = () => {
  const { closeModal } = useModal();
  const { startCampaign } = useGame();
  const { addToast, TOAST_TYPES } = useToast();
  const [loadingId, setLoadingId] = useState(null);

  const handleSelect = async (campaignId) => {
    if (loadingId) return;
    setLoadingId(campaignId);
    try {
      const campaign = await campaignsApi.getCampaign(campaignId);
      const levelIds = (campaign.levels || []).map((l) => l.level_id);
      if (levelIds.length === 0) {
        addToast(
          TOAST_TYPES.ERROR,
          "Campaign",
          "This campaign has no playable levels."
        );
        setLoadingId(null);
        return;
      }
      startCampaign({ campaignId, levelIds });
      closeModal();
    } catch (err) {
      console.error("Failed to start campaign:", err);
      addToast(TOAST_TYPES.ERROR, "Campaign", "Failed to start campaign.");
      setLoadingId(null);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 w-11/12 max-w-4xl h-3/4 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Select Campaign</h2>

        <div className="flex-1 min-h-0">
          <CampaignSelector mode="play" onSelect={handleSelect} />
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
