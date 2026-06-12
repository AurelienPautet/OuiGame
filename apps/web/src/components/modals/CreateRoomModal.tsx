import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useModal,
  useSocket,
  useGame,
  useAuth,
  useToast,
  TOAST_TYPES,
} from "../../contexts";
import { storage } from "../../lib/storage";
import { LevelSelector } from "../ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Input,
  SegmentedControl,
} from "../ui/primitives";

type RoomMode = "ffa" | "coop";

export const CreateRoomModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { socket } = useSocket();
  const { startOnlineGame } = useGame();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [roomName, setRoomName] = useState("");
  const [rounds, setRounds] = useState(10);
  const [roomMode, setRoomMode] = useState<RoomMode>("ffa");
  const [isCreating, setIsCreating] = useState(false);

  const handleMultiSelect = useCallback((levelIds: number[]) => {
    setSelectedLevels(levelIds);
  }, []);

  // Classic browses online levels, coop browses solo levels — a selection
  // never survives the switch (the ids would be from the wrong list).
  const handleModeChange = useCallback(
    (next: RoomMode) => {
      if (isCreating) return;
      setRoomMode(next);
      setSelectedLevels([]);
    },
    [isCreating]
  );

  // Listen for room creation success to auto-join
  useEffect(() => {
    if (!socket) return;
    const handleRoomCreated = (roomId: number) => {
      setIsCreating(false);
      startOnlineGame(roomId);
      closeModal();
    };
    const handleRoomCreateFailed = (reason: string) => {
      setIsCreating(false);
      addToast(
        TOAST_TYPES.ERROR,
        t("createRoom.failed"),
        t(`createRoom.failReason.${reason}`, t("common.unknownError"))
      );
    };
    socket.on("room_created", handleRoomCreated);
    socket.on("room_create_failed", handleRoomCreateFailed);
    return () => {
      socket.off("room_created", handleRoomCreated);
      socket.off("room_create_failed", handleRoomCreateFailed);
    };
  }, [socket, startOnlineGame, closeModal, addToast, t]);

  const handleCreateRoom = () => {
    if (!roomName || selectedLevels.length === 0) return;
    if (!socket) return;
    setIsCreating(true);
    // Guests can create rooms too; fall back to their chosen player name (or a
    // default) when not logged in. The trailing mode arg opts the room into
    // the pre-game lobby (old clients omit it and play immediately).
    const creator = user?.username ?? storage.getPlayerName() ?? "Player";
    socket.emit(
      "new-room",
      roomName,
      rounds,
      selectedLevels,
      creator,
      roomMode
    );
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

        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <Input
            className="flex-1 min-w-[200px]"
            placeholder={t("createRoom.roomNamePlaceholder")}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <SegmentedControl<RoomMode>
            aria-label={t("createRoom.mode")}
            value={roomMode}
            onValueChange={handleModeChange}
            options={[
              { value: "ffa", label: t("createRoom.modeClassic") },
              { value: "coop", label: t("createRoom.modeCoop") },
            ]}
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

        {roomMode === "coop" && (
          <p className="mb-3 text-sm font-semibold text-ink-soft">
            {t("createRoom.coopHint")}
          </p>
        )}

        <div className="flex-1 min-h-0">
          <LevelSelector
            key={roomMode}
            mode="room"
            onMultiSelect={handleMultiSelect}
            levelTypeOverride={roomMode === "coop" ? "solo" : "online"}
            requireBotSpawns={roomMode === "coop"}
          />
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
