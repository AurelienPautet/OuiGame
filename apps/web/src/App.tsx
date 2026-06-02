import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import {
  SocketProvider,
  AuthProvider,
  ModalProvider,
  GameProvider,
  ToastProvider,
  SettingsProvider,
  useGame,
} from "./contexts";
import { QueryProvider } from "./providers/QueryProvider";
import { ToastContainer } from "./components/ui";
import { LandingPage } from "./components/landing";
import { MenuLayout } from "./components/layout";
import { GameCanvas } from "./components/game";
import {
  LevelEditor,
  CampaignEditor,
  LevelsScreen,
  RankingsScreen,
} from "./pages";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants/canvas";

// Hook to calculate scale factor to fit the fixed gameplay/editor stage to window
const useWindowScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const widthRatio = window.innerWidth / CANVAS_WIDTH;
      const heightRatio = window.innerHeight / CANVAS_HEIGHT;
      // Use the smaller ratio to ensure content fits, with 5% margin
      setScale(Math.min(widthRatio, heightRatio) * 0.95);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  return scale;
};

// The scaled, fixed-size stage used by gameplay and the editors.
const ScaledStage = ({ children }: { children: React.ReactNode }) => {
  const scale = useWindowScale();
  return (
    <div className="w-screen h-screen overflow-hidden bg-ink flex items-center justify-center">
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
        {/* The editors (LevelEditor/CampaignEditor) raise validation toasts;
            without this container they'd add to state but never render. */}
        <ToastContainer />
      </div>
    </div>
  );
};

// In-game stage: also owns the theme-cycle (T) shortcut.
const GameView = () => {
  const scale = useWindowScale();
  const { cycleTheme } = useGame();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.code === "KeyT") cycleTheme();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-ink flex items-center justify-center">
      <div
        className="relative overflow-hidden"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          // Prevent the browser from claiming touch gestures (scroll/zoom) over
          // the game stage so the on-screen controls get every pointer event.
          touchAction: "none",
        }}
      >
        <GameCanvas scale={scale} />
        <ToastContainer />
      </div>
    </div>
  );
};

// Route "/": the immersive game stage while playing, otherwise the Home hub.
const MainContent = () => {
  const { isPlaying } = useGame();
  return isPlaying ? (
    <GameView />
  ) : (
    <MenuLayout>
      <LandingPage />
    </MenuLayout>
  );
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<MainContent />} />
      <Route
        path="/levels"
        element={
          <MenuLayout>
            <LevelsScreen />
          </MenuLayout>
        }
      />
      <Route
        path="/rankings"
        element={
          <MenuLayout>
            <RankingsScreen />
          </MenuLayout>
        }
      />
      <Route
        path="/editor"
        element={
          <ScaledStage>
            <LevelEditor />
          </ScaledStage>
        }
      />
      <Route
        path="/campaign-editor"
        element={
          <ScaledStage>
            <CampaignEditor />
          </ScaledStage>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <QueryProvider>
          <SocketProvider>
            <AuthProvider>
              <ToastProvider>
                <ModalProvider>
                  <SettingsProvider>
                    <GameProvider>
                      <AppRouter />
                    </GameProvider>
                  </SettingsProvider>
                </ModalProvider>
              </ToastProvider>
            </AuthProvider>
          </SocketProvider>
        </QueryProvider>
      </MotionConfig>
    </HashRouter>
  );
}

export default App;
