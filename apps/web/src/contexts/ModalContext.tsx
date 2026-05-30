import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// Modal names that can be opened
export const MODALS = {
  AUTH: "auth",
  PROFILE: "profile",
  RANKINGS: "rankings",
  ROOM_SELECTOR: "roomSelector",
  CREATE_ROOM: "createRoom",
  LEVEL_SELECTOR: "levelSelector",
  MY_LEVELS: "myLevels",
  TANK_SELECT: "tankSelect",
  CAMPAIGN_SELECTOR: "campaignSelector",
  MY_CAMPAIGNS: "myCampaigns",
} as const;

export type ModalName = (typeof MODALS)[keyof typeof MODALS];

interface ModalContextValue {
  activeModal: ModalName | null;
  modalData: unknown;
  openModal: (modal: ModalName, data?: unknown) => void;
  closeModal: () => void;
  isOpen: (m: ModalName) => boolean;
  MODALS: typeof MODALS;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [activeModal, setActiveModal] = useState<ModalName | null>(null);
  const [modalData, setModalData] = useState<unknown>(null);

  const openModal = useCallback(
    (modalName: ModalName, data: unknown = null) => {
      setActiveModal(modalName);
      setModalData(data);
    },
    []
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  const isOpen = useCallback(
    (modalName: ModalName) => {
      return activeModal === modalName;
    },
    [activeModal]
  );

  return (
    <ModalContext.Provider
      value={{
        activeModal,
        modalData,
        openModal,
        closeModal,
        isOpen,
        MODALS,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};
