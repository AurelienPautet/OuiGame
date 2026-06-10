import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useModal, useSocket, useGame, useAuth } from "../../contexts";
import { storage } from "../../lib/storage";
import { LevelSelector } from "../ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Input,
} from "../ui/primitives";

export const CreateRoomModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { socket } = useSocket();
  const { startOnlineGame } = useGame();
  const { user } = useAuth();
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [roomName, setRoomName] = useState("");
  const [rounds, setRounds] = useState(10);
  const [isCreating, setIsCreating] = useState(false);

  const handleMultiSelect = useCallback((levelIds: number[]) => {
    setSelectedLevels(levelIds);
  }, []);

  // Listen for room creation success to auto-join
  useEffect(() => {
    if (!socket) return;
    const handleRoomCreated = (roomId: number) => {
      setIsCreating(false);
      startOnlineGame(roomId);
      closeModal();
    };
    socket.on("room_created", handleRoomCreated);
    return () => {
      socket.off("room_created", handleRoomCreated);
    };
  }, [socket, startOnlineGame, closeModal]);

  const handleCreateRoom = () => {
    if (!roomName || selectedLevels.length === 0) return;
    if (!socket) return;
    setIsCreating(true);
    // Guests can create rooms too; fall back to their chosen player name (or a
    // default) when not logged in. Server expects (name, rounds, list_id, creator).
    const creator = user?.username ?? storage.getPlayerName() ?? "Player";
    socket.emit("new-room", roomName, rounds, selectedLevels, creator);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !isCreating) closeModal();
      }}
    >
      <DialogContent
        widthClassName="w-[min(94vw,920px)]"
        className="h-[82vh] flex flex-col overflow-hidden"
        showClose={!isCreating}
      >
        <DialogTitle className="text-2xl font-bold mb-4">
          {t("createRoom.title")}
        </DialogTitle>

        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            className="flex-1 min-w-[200px]"
            placeholder={t("createRoom.roomNamePlaceholder")}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <label className="flex items-center gap-2 font-semibold text-ink">
            {t("createRoom.rounds")}
            <Input
              type="number"
              className="w-20"
              min={1}
              max={99}
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value) || 1)}
            />
          </label>
        </div>

        <div className="flex-1 min-h-0">
          <LevelSelector mode="room" onMultiSelect={handleMultiSelect} />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={closeModal} disabled={isCreating}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="green"
            disabled={!roomName || selectedLevels.length === 0 || isCreating}
            onClick={handleCreateRoom}
          >
            {isCreating
              ? t("createRoom.creating")
              : t("createRoom.createWithCount", {
                  count: selectedLevels.length,
                })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
