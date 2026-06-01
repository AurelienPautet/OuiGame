import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useModal, useGame, useToast } from "../../contexts";
import { CampaignSelector } from "../ui";
import { campaignsApi } from "../../api";
import { Dialog, DialogContent, DialogTitle } from "../ui/primitives";

export const CampaignSelectorModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { startCampaign } = useGame();
  const { addToast, TOAST_TYPES } = useToast();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleSelect = async (campaignId: number) => {
    if (loadingId) return;
    setLoadingId(campaignId);
    try {
      const campaign = await campaignsApi.getCampaign(campaignId);
      const levelIds = (campaign.levels || []).map((l) => l.level_id);
      if (levelIds.length === 0) {
        addToast(
          TOAST_TYPES.ERROR,
          t("campaignEditor.toast.title"),
          t("campaignSelectorModal.noPlayableLevels")
        );
        setLoadingId(null);
        return;
      }
      startCampaign({ campaignId, levelIds });
      closeModal();
    } catch (err) {
      console.error("Failed to start campaign:", err);
      addToast(
        TOAST_TYPES.ERROR,
        t("campaignEditor.toast.title"),
        t("campaignSelectorModal.failedStart")
      );
      setLoadingId(null);
    }
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
          {t("campaignSelectorModal.title")}
        </DialogTitle>
        <div className="flex-1 min-h-0">
          <CampaignSelector mode="play" onSelect={handleSelect} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
