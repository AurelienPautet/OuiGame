import { useEffect, useState, lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import {
  SocketProvider,
  AuthProvider,
  ModalProvider,
  GameProvider,
  ToastProvider,
  useModal,
  useGame,
  MODALS,
} from "./contexts";
import { QueryProvider } from "./providers/QueryProvider";
import { ToastContainer, OnlineIndicator } from "./components/ui";
import { LandingPage, CANVAS_WIDTH, CANVAS_HEIGHT } from "./components/landing";
import { GameCanvas } from "./components/game";
import { LevelEditor, CampaignEditor } from "./pages";

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

const AuthModal = named(
  () => import("./components/modals/AuthModal"),
  "AuthModal"
);
const ProfileModal = named(
  () => import("./components/modals/ProfileModal"),
  "ProfileModal"
);
const RankingsModal = named(
  () => import("./components/modals/RankingsModal"),
  "RankingsModal"
);
const RoomSelectorModal = named(
  () => import("./components/modals/RoomSelectorModal"),
  "RoomSelectorModal"
);
const CreateRoomModal = named(
  () => import("./components/modals/CreateRoomModal"),
  "CreateRoomModal"
);
const LevelSelectorModal = named(
  () => import("./components/modals/LevelSelectorModal"),
  "LevelSelectorModal"
);
const MyLevelsModal = named(
  () => import("./components/modals/MyLevelsModal"),
  "MyLevelsModal"
);
const TankSelectModal = named(
  () => import("./components/modals/TankSelectModal"),
  "TankSelectModal"
);
const CampaignSelectorModal = named(
  () => import("./components/modals/CampaignSelectorModal"),
  "CampaignSelectorModal"
);
const MyCampaignsModal = named(
  () => import("./components/modals/MyCampaignsModal"),
  "MyCampaignsModal"
);

// Modal renderer component
const ModalRenderer = () => {
  const { activeModal } = useModal();

  return (
    <Suspense fallback={null}>
      {activeModal === MODALS.AUTH && <AuthModal />}
      {activeModal === MODALS.PROFILE && <ProfileModal />}
      {activeModal === MODALS.RANKINGS && <RankingsModal />}
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

// Hook to calculate scale factor to fit content to window
const useWindowScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      const widthRatio = windowWidth / CANVAS_WIDTH;
      const heightRatio = windowHeight / CANVAS_HEIGHT;

      // Use the smaller ratio to ensure content fits, with 5% margin
      const newScale = Math.min(widthRatio, heightRatio) * 0.95;
      setScale(newScale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);

    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  return scale;
};

// Main game/landing content with fixed dimensions and dynamic scaling
const MainContent = () => {
  const scale = useWindowScale();
  const { isPlaying, cycleTheme } = useGame();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }

      if (e.code === "KeyT") {
        cycleTheme();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-base-300 flex items-center justify-center">
      {/* Scaled container */}
      <div
        className="relative overflow-hidden"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Show game canvas when playing, otherwise show landing page */}
        {isPlaying ? (
          <>
            <GameCanvas scale={scale} />
            {/* Toast notifications during game */}
            <ToastContainer />
          </>
        ) : (
          <>
            {/* Online player indicator */}
            <OnlineIndicator />

            {/* Landing page */}
            <LandingPage />

            {/* Modals render on top when active */}
            <ModalRenderer />
          </>
        )}
      </div>
    </div>
  );
};

// Editor pages with their own scaling
interface ScaledPageProps {
  children: React.ReactNode;
}

const ScaledPage = ({ children }: ScaledPageProps) => {
  const scale = useWindowScale();

  return (
    <div className="w-screen h-screen overflow-hidden bg-base-300 flex items-center justify-center">
      <div
        className="relative overflow-hidden"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// App Router
const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<MainContent />} />
      <Route
        path="/editor"
        element={
          <ScaledPage>
            <LevelEditor />
          </ScaledPage>
        }
      />
      <Route
        path="/campaign-editor"
        element={
          <ScaledPage>
            <CampaignEditor />
          </ScaledPage>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <HashRouter>
      <QueryProvider>
        <SocketProvider>
          <AuthProvider>
            <ToastProvider>
              <ModalProvider>
                <GameProvider>
                  <AppRouter />
                </GameProvider>
              </ModalProvider>
            </ToastProvider>
          </AuthProvider>
        </SocketProvider>
      </QueryProvider>
    </HashRouter>
  );
}

export default App;
