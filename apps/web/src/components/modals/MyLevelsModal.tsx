import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useModal, useAuth } from "../../contexts";
import { LevelSelector } from "../ui";
import { useDeleteLevel } from "../../hooks/api";
import { Dialog, DialogContent, DialogTitle, Button } from "../ui/primitives";

export const MyLevelsModal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { user } = useAuth();
  const deleteLevel = useDeleteLevel();

  const handleEdit = (levelId: number) => {
    closeModal();
    navigate(`/editor?id=${levelId}`);
  };

  const handleDelete = (levelId: number) => {
    if (window.confirm(t("myLevels.confirmDelete"))) {
      deleteLevel.mutate(levelId);
    }
  };

  const handleCreate = () => {
    closeModal();
    navigate("/editor");
  };

  const close = (o: boolean) => {
    if (!o) closeModal();
  };

  if (!user) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent widthClassName="w-[min(94vw,440px)]">
          <DialogTitle className="text-2xl font-bold mb-3">
            {t("myLevels.title")}
          </DialogTitle>
          <p className="text-ink-soft mb-5">{t("myLevels.loginToView")}</p>
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
          {t("myLevels.title")}
        </DialogTitle>
        <div className="flex-1 min-h-0">
          <LevelSelector
            mode="myLevels"
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
