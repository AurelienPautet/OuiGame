import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { useModal, MODALS } from "../../contexts";

// Modals are split into their own chunks and only fetched when first opened.
const named = (
  importer: () => Promise<Record<string, ComponentType>>,
  name: string
) =>
  lazy(() =>
    importer().then((m) => {
      const component = m[name];
      if (!component) {
        throw new Error(`Module is missing expected export "${name}"`);
      }
      return { default: component };
    })
  );

const AuthModal = named(() => import("./AuthModal"), "AuthModal");
const ProfileModal = named(() => import("./ProfileModal"), "ProfileModal");
const RoomSelectorModal = named(
  () => import("./RoomSelectorModal"),
  "RoomSelectorModal"
);
const CreateRoomModal = named(
  () => import("./CreateRoomModal"),
  "CreateRoomModal"
);
const LevelSelectorModal = named(
  () => import("./LevelSelectorModal"),
  "LevelSelectorModal"
);
const MyLevelsModal = named(() => import("./MyLevelsModal"), "MyLevelsModal");
const TankSelectModal = named(
  () => import("./TankSelectModal"),
  "TankSelectModal"
);
const CampaignSelectorModal = named(
  () => import("./CampaignSelectorModal"),
  "CampaignSelectorModal"
);
const MyCampaignsModal = named(
  () => import("./MyCampaignsModal"),
  "MyCampaignsModal"
);

/** Renders whichever overlay ModalContext currently has open (at most one). */
export const ModalRenderer = () => {
  const { activeModal } = useModal();

  return (
    <Suspense fallback={null}>
      {activeModal === MODALS.AUTH && <AuthModal />}
      {activeModal === MODALS.PROFILE && <ProfileModal />}
      {activeModal === MODALS.ROOM_SELECTOR && <RoomSelectorModal />}
      {activeModal === MODALS.CREATE_ROOM && <CreateRoomModal />}
      {activeModal === MODALS.LEVEL_SELECTOR && <LevelSelectorModal />}
      {activeModal === MODALS.MY_LEVELS && <MyLevelsModal />}
      {activeModal === MODALS.TANK_SELECT && <TankSelectModal />}
      {activeModal === MODALS.CAMPAIGN_SELECTOR && <CampaignSelectorModal />}
      {activeModal === MODALS.MY_CAMPAIGNS && <MyCampaignsModal />}
    </Suspense>
  );
};
