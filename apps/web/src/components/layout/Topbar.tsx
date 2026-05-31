import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Swords, Settings } from "lucide-react";
import { useModal, useAuth, useSocket, MODALS } from "../../contexts";
import { storage } from "../../lib/storage";
import { colorFromIndex } from "../../constants/tankColors";
import { TankAvatar } from "../ui/primitives";
import { cn } from "../../lib/cn";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "font-display font-semibold text-sm px-3.5 py-2 rounded-[11px] transition-colors cursor-pointer",
    isActive
      ? "bg-blue text-white shadow-[0_3px_0_#0085a8]"
      : "text-white/80 hover:bg-white/10 hover:text-white"
  );

const pillBtn =
  "font-display font-semibold text-sm px-3.5 py-2 rounded-[11px] transition-colors cursor-pointer text-white/80 hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5";

/** Persistent arcade navigation shown on the menu screens (hidden in-game). */
export const Topbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { user } = useAuth();
  const { onlineCount, isConnected } = useSocket();

  const bodyColor = colorFromIndex(storage.getBodyIndex());
  const turretColor = colorFromIndex(storage.getTurretIndex());

  return (
    <header className="sticky top-0 z-50 bg-panel-dark/[0.86] backdrop-blur border-b-4 border-ink">
      <div className="max-w-[1280px] mx-auto px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <TankAvatar bodyColor="blue" turretColor="blue" size={36} />
          <b className="text-xl font-bold tracking-wide text-white [text-shadow:2px_2px_0_var(--color-ink)]">
            OUI<span className="text-yellow">TANK</span>
          </b>
        </button>

        <nav className="flex items-center gap-1.5 flex-wrap ml-1">
          <NavLink to="/" end className={navClass}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/levels" className={navClass}>
            {t("nav.playSolo")}
          </NavLink>
          <NavLink to="/rankings" className={navClass}>
            {t("nav.rankings")}
          </NavLink>
          <button
            type="button"
            className={pillBtn}
            onClick={() => openModal(MODALS.MY_LEVELS)}
          >
            <Pencil size={15} strokeWidth={2.5} /> {t("nav.editor")}
          </button>
          <button
            type="button"
            className={pillBtn}
            onClick={() => openModal(MODALS.MY_CAMPAIGNS)}
          >
            <Swords size={15} strokeWidth={2.5} /> {t("nav.campaigns")}
          </button>
        </nav>

        <div className="flex-1" />

        <div
          className={cn(
            "hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[3px] border-ink",
            isConnected ? "bg-white/10" : "bg-red/20"
          )}
          title={isConnected ? t("topbar.connected") : t("topbar.disconnected")}
        >
          <span
            className={cn(
              "size-2.5 rounded-full border-2 border-ink",
              isConnected ? "bg-green" : "bg-red"
            )}
          />
          <span className="text-white font-bold text-sm leading-none">
            {onlineCount}
          </span>
          <span className="text-white/60 text-xs uppercase tracking-wide">
            {t("topbar.online")}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openModal(MODALS.SETTINGS)}
          className="inline-flex items-center justify-center size-9 rounded-full border-[3px] border-ink bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          title={t("topbar.settings")}
          aria-label={t("topbar.settings")}
        >
          <Settings size={17} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => openModal(user ? MODALS.PROFILE : MODALS.AUTH)}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border-[3px] border-ink rounded-full pl-1.5 pr-3.5 py-1 cursor-pointer transition-colors"
          title={user ? t("topbar.profile") : t("topbar.login")}
        >
          <TankAvatar
            bodyColor={bodyColor}
            turretColor={turretColor}
            size={28}
          />
          <span className="text-white font-semibold text-sm">
            {user ? user.username : t("topbar.login")}
          </span>
        </button>
      </div>
    </header>
  );
};
