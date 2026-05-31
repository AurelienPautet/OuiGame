import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, RefreshCw, Gamepad2 } from "lucide-react";
import { useModal, useGame, MODALS } from "../../contexts";
import { RoomCard } from "../ui/RoomCard";
import { useRooms } from "../../hooks/api";
import type { RoomSummary } from "@ouigame/shared/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Input,
  Select,
} from "../ui/primitives";

export const RoomSelectorModal = () => {
  const { t } = useTranslation();
  const { closeModal, openModal } = useModal();
  const { startOnlineGame } = useGame();
  const [searchName, setSearchName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);

  const { data: roomsData = [], isLoading, refetch } = useRooms();
  const rooms = roomsData;

  const filteredRooms = rooms.filter((room: RoomSummary) => {
    const nameMatch = room.name
      .toLowerCase()
      .includes(searchName.toLowerCase());
    const playerMatch = maxPlayers === 0 || room.maxPlayers === maxPlayers;
    return nameMatch && playerMatch;
  });

  const handleJoinRoom = (roomId: RoomSummary["id"]) => {
    startOnlineGame(roomId);
    closeModal();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent
        widthClassName="w-[min(94vw,760px)]"
        className="h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center mb-4 pr-10">
          <DialogTitle className="text-2xl font-bold">
            {t("rooms.playOnline")}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
            />
            <Input
              className="pl-10"
              placeholder={t("rooms.searchPlaceholder")}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by player count"
            value={String(maxPlayers)}
            onValueChange={(v) => setMaxPlayers(Number(v))}
            options={[
              { value: "0", label: t("rooms.anyPlayers") },
              ...[2, 3, 4, 5, 6, 7, 8].map((n) => ({
                value: String(n),
                label: t("rooms.players", { count: n }),
              })),
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <button
            type="button"
            onClick={() => openModal(MODALS.CREATE_ROOM)}
            className="flex w-full items-center gap-4 p-4 rounded-xl bg-field border-[3px] border-ink hover:bg-[#bcc1c8] cursor-pointer transition-colors text-left"
          >
            <span className="size-14 bg-blue/20 border-[3px] border-ink rounded-lg flex items-center justify-center shrink-0">
              <Plus size={28} strokeWidth={3} className="text-blue-d" />
            </span>
            <span>
              <span className="block text-lg font-bold text-ink">
                {t("rooms.createNewRoom")}
              </span>
              <span className="text-ink-soft text-sm">
                {t("rooms.publicOrPrivate")}
              </span>
            </span>
          </button>

          {isLoading && rooms.length === 0 ? (
            <div className="text-center py-8 text-ink-soft">
              {t("rooms.loadingRooms")}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-ink-soft">
              <Gamepad2 size={56} className="mx-auto mb-3 opacity-50" />
              <p className="font-semibold">{t("rooms.noRooms")}</p>
              <p className="text-sm">{t("rooms.createToStart")}</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => handleJoinRoom(room.id)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
