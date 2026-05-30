import { useState, useEffect } from "react";
import {
  User,
  Trophy,
  Pencil,
  Mail,
  ExternalLink,
  Github,
  Paintbrush,
  Swords,
} from "lucide-react";
import { useModal, useAuth, MODALS } from "../../contexts";
import { TANK_COLORS as COLORS } from "../../constants/tankColors";
import { storage } from "../../lib/storage";

// Fixed dimensions matching original
const CANVAS_WIDTH = 1150;
const CANVAS_HEIGHT = 800;

export const LandingPage = () => {
  const { openModal, activeModal } = useModal();
  const { user } = useAuth();

  // Player name from localStorage
  const [playerName, setPlayerName] = useState(() => {
    return storage.getPlayerName() || "";
  });

  // Tank colors from localStorage
  const [tankColors, setTankColors] = useState({
    body: "orange",
    turret: "orange",
  });

  // Save player name to localStorage on change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setPlayerName(name);
    storage.setPlayerName(name);
  };

  // When logged in, use account username as player name
  useEffect(() => {
    if (user?.username) {
      storage.setPlayerName(user.username);
      setPlayerName(user.username);
    }
  }, [user]);

  // Load tank colors from localStorage on mount and when modal closes
  useEffect(() => {
    const loadTankColors = () => {
      const bodyIdx = storage.getBodyIndex();
      const turretIdx = storage.getTurretIndex();

      setTankColors({
        body:
          bodyIdx !== null && bodyIdx >= 0 && bodyIdx < COLORS.length
            ? COLORS[bodyIdx]
            : "orange",
        turret:
          turretIdx !== null && turretIdx >= 0 && turretIdx < COLORS.length
            ? COLORS[turretIdx]
            : "orange",
      });
    };

    loadTankColors();

    // Reload when tank select modal closes
    if (activeModal === null) {
      loadTankColors();
    }
  }, [activeModal]);

  return (
    <div className="bg-base-200 w-full h-full absolute flex flex-col justify-center items-center">
      {/* Title */}
      <h1 className="text-white text-7xl font-bold m-10 z-50">OUI TANK</h1>

      {/* Login/Profile Button - Top Left */}
      <div className="absolute w-44 h-56 left-5 top-5 z-50">
        <div className="flex w-full h-full justify-center items-center flex-col">
          <button
            className="btn btn-ghost btn-circle btn-lg"
            onClick={() => openModal(user ? MODALS.PROFILE : MODALS.AUTH)}
          >
            <User className="w-12 h-12 text-primary" />
          </button>
          <h3 className="font-bold text-white mt-2">
            {user ? user.username : "Not logged in"}
          </h3>
        </div>
      </div>

      {/* Level Editor Button - Bottom Left */}
      <div className="absolute w-44 left-5 bottom-12 z-50">
        <div className="flex w-full justify-center items-center flex-col">
          <button
            className="btn btn-ghost btn-circle btn-lg"
            onClick={() => openModal(MODALS.MY_LEVELS)}
          >
            <Pencil className="w-12 h-12 text-primary" />
          </button>
          <h3 className="font-bold text-white mt-2">Level editor</h3>
        </div>
      </div>

      {/* My Campaigns Button - Left (above Level Editor) */}
      <div className="absolute w-44 left-5 bottom-44 z-50">
        <div className="flex w-full justify-center items-center flex-col">
          <button
            className="btn btn-ghost btn-circle btn-lg"
            onClick={() => openModal(MODALS.MY_CAMPAIGNS)}
          >
            <Swords className="w-12 h-12 text-primary" />
          </button>
          <h3 className="font-bold text-white mt-2">Campaigns</h3>
        </div>
      </div>

      {/* Rankings Button - Top Right */}
      <div className="absolute w-44 h-56 right-5 top-5 z-50">
        <div className="flex w-full h-full justify-center items-center flex-col">
          <button
            className="btn btn-ghost btn-circle btn-lg"
            onClick={() => openModal(MODALS.RANKINGS)}
          >
            <Trophy className="w-12 h-12 text-primary" />
          </button>
          <h3 className="font-bold text-white mt-2">Rankings</h3>
        </div>
      </div>

      {/* Footer Links - Bottom Right */}
      <div className="absolute right-5 bottom-5 z-50">
        <div className="font-bold text-white flex items-center gap-4">
          <a
            href="https://aurelien.pautet.net/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline hover:text-primary transition-colors"
          >
            <Mail className="w-6 h-6" />
            <span>Contact</span>
          </a>
          <a
            href="https://aurelien.pautet.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline hover:text-primary transition-colors"
          >
            <ExternalLink className="w-6 h-6" />
            <span>About Me</span>
          </a>
          <a
            href="https://github.com/AurelienPautet/WiiGameBien"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline hover:text-primary transition-colors"
          >
            <Github className="w-6 h-6" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      {/* Tank Visualizer */}
      <div className="h-56 w-72 bg-base-100 flex justify-center items-center relative rounded-md">
        <img
          className="w-28 h-24 absolute"
          src={`ressources/image/tank_player/body_${tankColors.body}.png`}
          alt="Tank body"
        />
        <img
          className="w-32 h-16 absolute -mt-5 -ml-15"
          src={`ressources/image/tank_player/turret_${tankColors.turret}.png`}
          alt="Tank turret"
        />
        <button
          className="btn btn-ghost btn-circle absolute top-3 right-3"
          onClick={() => openModal(MODALS.TANK_SELECT)}
        >
          <Paintbrush className="w-6 h-6 text-primary" />
        </button>
      </div>

      {/* Name Input - only shown when not logged in */}
      {!user && (
        <div className="h-20 w-1/3 flex justify-center items-center mt-4">
          <input
            className="input input-bordered bg-base-300 text-white placeholder:text-slate-300 focus:outline-primary w-64"
            placeholder="Type your name.."
            type="text"
            name="name"
            maxLength={20}
            value={playerName}
            onChange={handleNameChange}
          />
        </div>
      )}

      {/* Play Buttons */}
      <div className="h-24 w-1/3 flex justify-center items-center rounded-md mt-3 gap-4">
        <button
          className="btn btn-primary h-14 px-8 text-lg font-extrabold"
          onClick={() => openModal(MODALS.ROOM_SELECTOR)}
        >
          Play Online
        </button>
        <button
          className="btn btn-primary h-14 px-8 text-lg font-extrabold"
          onClick={() => openModal(MODALS.LEVEL_SELECTOR)}
        >
          Play Solo
        </button>
        <button
          className="btn btn-secondary h-14 px-8 text-lg font-extrabold"
          onClick={() => openModal(MODALS.CAMPAIGN_SELECTOR)}
        >
          Play Campaign
        </button>
      </div>
    </div>
  );
};

// Export dimensions for use in other components
export { CANVAS_WIDTH, CANVAS_HEIGHT };
