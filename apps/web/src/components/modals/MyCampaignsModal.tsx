import { useNavigate } from "react-router-dom";
import { useModal, useAuth } from "../../contexts";
import { CampaignSelector } from "../ui";
import { useDeleteCampaign } from "../../hooks/api";
import { Dialog, DialogContent, DialogTitle, Button } from "../ui/primitives";

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

  const close = (o: boolean) => {
    if (!o) closeModal();
  };

  if (!user) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent widthClassName="w-[min(94vw,440px)]">
          <DialogTitle className="text-2xl font-bold mb-3">
            Your Campaigns
          </DialogTitle>
          <p className="text-ink-soft mb-5">
            Please log in to create and manage campaigns.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={closeModal}>
              Close
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
          Your Campaigns
        </DialogTitle>
        <div className="flex-1 min-h-0">
          <CampaignSelector
            mode="my"
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
