import { useEffect } from "react";
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
import { LandingPage } from "./components/landing";
import { MenuLayout, ScaledStage } from "./components/layout";
import { GameCanvas } from "./components/game";
import { MusicController } from "./components/MusicController";
import {
  LevelEditor,
  CampaignEditor,
  LevelsScreen,
  RankingsScreen,
  AdminDashboard,
} from "./pages";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

// In-game stage: also owns the theme-cycle (T) shortcut.
const GameView = () => {
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
    <ScaledStage touchAction="none">
      <GameCanvas />
    </ScaledStage>
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
        path="/admin"
        element={
          <MenuLayout>
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
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
                      <MusicController />
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
