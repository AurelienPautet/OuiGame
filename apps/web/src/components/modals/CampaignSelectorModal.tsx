import { useTranslation } from "react-i18next";
import { useModal } from "../../contexts";
import { CampaignSelector } from "../ui";
import { useStartCampaign } from "../../hooks/useStartCampaign";
import { Dialog, DialogContent, DialogTitle } from "../ui/primitives";

export const CampaignSelectorModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { start: startCampaignById } = useStartCampaign();

  const handleSelect = (campaignId: number) => {
    startCampaignById(campaignId, closeModal);
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
