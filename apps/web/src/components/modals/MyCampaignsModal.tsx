import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useModal, useAuth, useGame, useToast } from "../../contexts";
import { CampaignSelector } from "../ui";
import { campaignsApi } from "../../api";
import { useDeleteCampaign } from "../../hooks/api";
import { Dialog, DialogContent, DialogTitle, Button } from "../ui/primitives";

export const MyCampaignsModal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { user } = useAuth();
  const { startCampaign } = useGame();
  const { addToast, TOAST_TYPES } = useToast();
  const deleteCampaign = useDeleteCampaign();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Mirrors CampaignSelectorModal: a campaign has no playable grid of its own,
  // so we fetch its level ids before kicking off the run.
  const handlePlay = async (campaignId: number) => {
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

  const handleEdit = (campaignId: number) => {
    closeModal();
    navigate(`/campaign-editor?id=${campaignId}`);
  };

  const handleDelete = (campaignId: number) => {
    if (window.confirm(t("myCampaigns.confirmDelete"))) {
      deleteCampaign.mutate(campaignId);
    }
  };

  const handleCreate = () => {
    closeModal();
    navigate("/campaign-editor");
  };

  const close = (o: boolean) => {
    if (!o) closeModal();
  };

  if (!user) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent widthClassName="w-[min(94vw,440px)]">
          <DialogTitle className="text-2xl font-bold mb-3">
            {t("myCampaigns.title")}
          </DialogTitle>
          <p className="text-ink-soft mb-5">{t("myCampaigns.loginToManage")}</p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={closeModal}>
              {t("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent
        widthClassName="w-[min(94vw,920px)]"
        className="h-[82vh] flex flex-col overflow-hidden"
      >
        <DialogTitle className="text-2xl font-bold mb-4">
          {t("myCampaigns.title")}
        </DialogTitle>
        <div className="flex-1 min-h-0">
          <CampaignSelector
            mode="my"
            onPlay={handlePlay}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
