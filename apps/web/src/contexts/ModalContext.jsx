import { createContext, useContext, useState, useCallback } from "react";

const ModalContext = createContext(null);

export const useModal = () => useContext(ModalContext);

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
};

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);

  const openModal = useCallback((modalName, data = null) => {
    setActiveModal(modalName);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  const isOpen = useCallback(
    (modalName) => {
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
