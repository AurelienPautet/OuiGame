import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Gamepad2,
  Flag,
  Paintbrush,
  Mail,
  ExternalLink,
  Github,
  Star,
} from "lucide-react";
import { useModal, useAuth, MODALS } from "../../contexts";
import { colorFromIndex } from "../../constants/tankColors";
import { storage } from "../../lib/storage";
import { useRankings } from "../../hooks/api";
import { motion } from "motion/react";
import {
  Button,
  Panel,
  DarkPanel,
  IoTitle,
  SectionLabel,
  Input,
  IconButton,
  TankAvatar,
} from "../ui/primitives";
import { Stagger, MotionItem, FloatY } from "../../lib/motionComponents";
import { springs } from "../../lib/motion";
import { palette } from "../../theme/palette";

const BAR_COLORS = [
  palette.blue,
  palette.red,
  palette.green,
  palette.purple,
  palette.yellow,
];

export const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openModal, activeModal } = useModal();
  const { user } = useAuth();
  const { data: topPlayers = [] } = useRankings("KILLS");

  const [playerName, setPlayerName] = useState(
    () => storage.getPlayerName() || ""
  );
  const [tankColors, setTankColors] = useState({
    body: "orange",
    turret: "orange",
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
    storage.setPlayerName(e.target.value);
  };

  useEffect(() => {
    if (user?.username) {
      storage.setPlayerName(user.username);
      setPlayerName(user.username);
    }
  }, [user]);

  // Reload tank colours on mount and whenever an overlay (e.g. Tank Select) closes.
  useEffect(() => {
    setTankColors({
      body: colorFromIndex(storage.getBodyIndex()),
      turret: colorFromIndex(storage.getTurretIndex()),
    });
  }, [activeModal]);

  const leaders = topPlayers.slice(0, 5);
  const maxData = leaders.reduce(
    (m, p) => Math.max(m, Number(p.total_data)),
    1
  );

  return (
    <div className="pt-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-stretch">
        {/* LEFT — branding + play buttons */}
        <Panel className="relative overflow-hidden rounded-[22px] p-8 bg-gradient-to-b from-white to-[#f3f5f8]">
          <div className="absolute inset-0 opacity-50 pointer-events-none graph-paper-soft" />
          <Stagger className="relative z-10">
            <MotionItem>
              <span className="inline-block mb-3 rounded-lg border-2 border-ink bg-green px-3 py-1 text-sm font-bold text-white">
                🚀 Preview deploy test
              </span>
            </MotionItem>
            <MotionItem>
              <SectionLabel className="mb-3.5">
                {user
                  ? t("landing.welcomeBack", { name: user.username })
                  : t("landing.welcome")}
              </SectionLabel>
            </MotionItem>
            <MotionItem>
              <IoTitle as="h1" className="text-6xl leading-[0.95] my-1">
                OUI&nbsp;TANK
              </IoTitle>
            </MotionItem>
            <MotionItem>
              <p className="text-lg text-ink-soft font-medium max-w-[440px] mt-3 mb-6">
                {t("landing.tagline")}
              </p>
            </MotionItem>

            {!user && (
              <MotionItem>
                <Input
                  className="max-w-[280px] mb-4"
                  placeholder={t("landing.namePlaceholder")}
                  maxLength={20}
                  value={playerName}
                  onChange={handleNameChange}
                />
              </MotionItem>
            )}

            <MotionItem className="flex flex-col gap-3 max-w-[440px]">
              <Button
                variant="green"
                size="lg"
                className="justify-start gap-4 py-5 text-xl"
                onClick={() => openModal(MODALS.ROOM_SELECTOR)}
              >
                <Play size={26} strokeWidth={3} className="shrink-0" />
                <span className="text-left leading-tight">
                  {t("landing.playOnline")}
                  <span className="block text-sm font-medium opacity-85">
                    {t("landing.playOnlineSub")}
                  </span>
                </span>
              </Button>
              <Button
                variant="blue"
                size="lg"
                className="justify-start gap-4"
                onClick={() => navigate("/levels")}
              >
                <Gamepad2 size={24} strokeWidth={3} className="shrink-0" />
                <span className="text-left leading-tight">
                  {t("landing.playSolo")}
                  <span className="block text-sm font-medium opacity-85">
                    {t("landing.playSoloSub")}
                  </span>
                </span>
              </Button>
              <Button
                variant="yellow"
                size="lg"
                className="justify-start gap-4"
                onClick={() => openModal(MODALS.CAMPAIGN_SELECTOR)}
              >
                <Flag size={24} strokeWidth={3} className="shrink-0" />
                <span className="text-left leading-tight">
                  {t("landing.playCampaign")}
                  <span className="block text-sm font-medium opacity-85">
                    {t("landing.playCampaignSub")}
                  </span>
                </span>
              </Button>
            </MotionItem>
          </Stagger>
        </Panel>

        {/* RIGHT — tank stage + leaderboard */}
        <div className="flex flex-col gap-4">
          <Panel className="relative flex-1 flex flex-col items-center rounded-[22px] p-5 graph-paper">
            <span className="absolute top-3.5 left-3.5 bg-panel-dark/[0.86] text-white text-xs font-semibold tracking-wide px-2.5 py-1 rounded-lg border-2 border-ink">
              {t("landing.yourTank")}
            </span>
            <IconButton
              className="absolute top-3.5 right-3.5"
              onClick={() => openModal(MODALS.TANK_SELECT)}
              title={t("landing.customizeTank")}
            >
              <Paintbrush size={18} strokeWidth={2.5} />
            </IconButton>
            <div className="flex-1 flex items-center justify-center py-4">
              <FloatY distance={10}>
                <TankAvatar
                  bodyColor={tankColors.body}
                  turretColor={tankColors.turret}
                  size={190}
                />
              </FloatY>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openModal(MODALS.TANK_SELECT)}
            >
              {t("landing.customize")}
            </Button>
          </Panel>

          <DarkPanel className="p-4">
            <h4 className="flex items-center gap-1.5 m-0 mb-2.5 text-sm tracking-[2px] uppercase">
              <Star size={15} className="fill-yellow text-yellow" />{" "}
              {t("landing.leaderboard")}
            </h4>
            {leaders.length === 0 ? (
              <p className="text-white/50 text-sm py-2">
                {t("landing.noRankings")}
              </p>
            ) : (
              leaders.map((p, i) => (
                <div
                  key={p.username}
                  className="flex items-center gap-2.5 mb-2 last:mb-0"
                >
                  <span className="text-[13px] text-white w-24 font-semibold truncate">
                    {p.username}
                  </span>
                  <div className="flex-1 h-4 rounded-lg border-2 border-ink bg-white/10 overflow-hidden">
                    <motion.span
                      className="block h-full origin-left"
                      style={{
                        width: `${Math.max(8, (Number(p.total_data) / maxData) * 100)}%`,
                        background: BAR_COLORS[i % BAR_COLORS.length],
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...springs.soft, delay: 0.15 + i * 0.08 }}
                    />
                  </div>
                  <span className="text-xs text-white/70 w-12 text-right">
                    {p.total_data}
                  </span>
                </div>
              ))
            )}
          </DarkPanel>
        </div>
      </div>

      <footer className="mt-8 text-center text-ink-soft font-medium text-sm">
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://aurelien.pautet.net/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-d font-semibold hover:underline"
          >
            <Mail size={16} /> {t("landing.contact")}
          </a>
          <a
            href="https://aurelien.pautet.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-d font-semibold hover:underline"
          >
            <ExternalLink size={16} /> {t("landing.about")}
          </a>
          <a
            href="https://github.com/AurelienPautet/WiiGameBien"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-d font-semibold hover:underline"
          >
            <Github size={16} /> {t("landing.github")}
          </a>
        </div>
        <div className="mt-1.5 opacity-70">{t("landing.copyright")}</div>
      </footer>
    </div>
  );
};
