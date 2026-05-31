import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  LogOut,
  Trophy,
  Activity,
  Swords,
  Skull,
  Target,
  Crosshair,
  TrendingUp,
  Scale,
  Bomb,
  Hammer,
  Gamepad2,
  CheckCircle,
} from "lucide-react";
import { useModal, useAuth } from "../../contexts";
import { usePlayerStats, useMySoloStats } from "../../hooks/api";
import type { MyStats, MySoloStats } from "@ouigame/shared/api";
import { storage } from "../../lib/storage";
import { colorFromIndex } from "../../constants/tankColors";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  TankAvatar,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

export const ProfileModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { user, logout } = useAuth();
  const { data: stats, isLoading } = usePlayerStats();
  const { data: soloStats, isLoading: soloLoading } = useMySoloStats();

  const handleLogout = () => {
    logout();
    closeModal();
  };

  const s = stats ?? ({} as Partial<NonNullable<MyStats>>);
  const rounds = Number(s.rounds_played) || 0;
  const wins = Number(s.wins) || 0;
  const kills = Number(s.kills) || 0;
  const deaths = Number(s.deaths) || 0;
  const shots = Number(s.shots) || 0;
  const hits = Number(s.hits) || 0;
  const plants = Number(s.plants) || 0;
  const blocks = Number(s.blocks_destroyed) || 0;
  const winRate = rounds > 0 ? ((wins / rounds) * 100).toFixed(1) + "%" : "0%";
  const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(0);
  const accuracy = shots > 0 ? ((hits / shots) * 100).toFixed(1) + "%" : "0%";

  const solo = soloStats ?? ({} as Partial<MySoloStats>);
  const soloLevelsCompleted = Number(solo.levelsCompleted) || 0;
  const soloTotalRounds = Number(solo.totalRounds) || 0;
  const soloTotalWins = Number(solo.totalWins) || 0;
  const soloWinRate = solo.winRate ? `${solo.winRate}%` : "0%";
  const soloKills = Number(solo.totalKills) || 0;
  const soloDeaths = Number(solo.totalDeaths) || 0;
  const soloAccuracy = solo.avgAccuracy ? `${solo.avgAccuracy}%` : "0%";
  const soloKdRatio =
    soloDeaths > 0 ? (soloKills / soloDeaths).toFixed(2) : soloKills.toFixed(0);

  const bodyColor = colorFromIndex(storage.getBodyIndex());
  const turretColor = colorFromIndex(storage.getTurretIndex());

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent
        widthClassName="w-[min(94vw,860px)]"
        className="h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-4 mb-4 pr-10">
          <div className="bg-field border-[3px] border-ink rounded-2xl p-1.5 shrink-0">
            <TankAvatar
              bodyColor={bodyColor}
              turretColor={turretColor}
              size={56}
            />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-2xl font-extrabold truncate">
              {user?.username || t("common.guest")}
            </DialogTitle>
            <p className="text-ink-soft text-sm truncate">
              {user?.email || t("profile.noEmail")}
            </p>
          </div>
          <div className="flex-1" />
          <Button variant="red" size="sm" onClick={handleLogout}>
            <LogOut size={16} /> {t("profile.logout")}
          </Button>
        </div>

        <Tabs defaultValue="solo" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mb-4 border-b-[3px] border-ink shrink-0">
            <TabsTrigger value="solo">
              <Gamepad2 size={16} className="mr-1.5 inline" />{" "}
              {t("profile.solo")}
            </TabsTrigger>
            <TabsTrigger value="online">
              <Swords size={16} className="mr-1.5 inline" />{" "}
              {t("profile.multiplayer")}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            <TabsContent value="solo">
              {soloLoading ? (
                <Loading />
              ) : soloTotalRounds > 0 ? (
                <Grid>
                  <StatCard
                    title={t("profile.levelsCompleted")}
                    value={soloLevelsCompleted}
                    icon={CheckCircle}
                    color="text-green"
                  />
                  <StatCard
                    title={t("profile.soloRounds")}
                    value={soloTotalRounds}
                    icon={Gamepad2}
                    color="text-blue-d"
                  />
                  <StatCard
                    title={t("profile.victories")}
                    value={soloTotalWins}
                    icon={Trophy}
                    color="text-yellow-d"
                  />
                  <StatCard
                    title={t("profile.winRate")}
                    value={soloWinRate}
                    icon={TrendingUp}
                    color="text-green"
                  />
                  <StatCard
                    title={t("profile.soloKills")}
                    value={soloKills}
                    icon={Swords}
                    color="text-red"
                  />
                  <StatCard
                    title={t("profile.soloKd")}
                    value={soloKdRatio}
                    icon={Scale}
                    color="text-purple"
                  />
                  <StatCard
                    title={t("profile.soloAccuracy")}
                    value={soloAccuracy}
                    icon={Target}
                    color="text-blue-d"
                  />
                </Grid>
              ) : (
                <Empty text={t("profile.noSolo")} />
              )}
            </TabsContent>

            <TabsContent value="online">
              {isLoading ? (
                <Loading />
              ) : rounds > 0 ? (
                <Grid>
                  <StatCard
                    title={t("profile.roundsPlayed")}
                    value={rounds}
                    icon={Activity}
                    color="text-blue-d"
                  />
                  <StatCard
                    title={t("profile.wins")}
                    value={wins}
                    icon={Trophy}
                    color="text-yellow-d"
                  />
                  <StatCard
                    title={t("profile.winRate")}
                    value={winRate}
                    icon={TrendingUp}
                    color="text-green"
                  />
                  <StatCard
                    title={t("profile.kills")}
                    value={kills}
                    icon={Swords}
                    color="text-red"
                  />
                  <StatCard
                    title={t("profile.deaths")}
                    value={deaths}
                    icon={Skull}
                    color="text-ink"
                  />
                  <StatCard
                    title={t("profile.kdRatio")}
                    value={kdRatio}
                    icon={Scale}
                    color="text-purple"
                  />
                  <StatCard
                    title={t("profile.shotsFired")}
                    value={shots}
                    icon={Crosshair}
                    color="text-orange-d"
                  />
                  <StatCard
                    title={t("profile.hits")}
                    value={hits}
                    icon={Target}
                    color="text-blue-d"
                  />
                  <StatCard
                    title={t("profile.accuracy")}
                    value={accuracy}
                    icon={Target}
                    color="text-blue-d"
                  />
                  <StatCard
                    title={t("profile.minesPlanted")}
                    value={plants}
                    icon={Bomb}
                    color="text-red"
                  />
                  <StatCard
                    title={t("profile.blocksBroken")}
                    value={blocks}
                    icon={Hammer}
                    color="text-yellow-d"
                  />
                </Grid>
              ) : (
                <Empty text={t("profile.noMultiplayer")} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    {children}
  </div>
);

const Loading = () => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-8 text-ink-soft">{t("common.loading")}</div>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div className="text-center py-6 text-ink-soft">{text}</div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
  <div className="bg-field border-[3px] border-ink rounded-xl p-3 flex items-center gap-3">
    <div className="p-2 rounded-lg bg-white border-2 border-ink shrink-0">
      <Icon size={22} className={color} />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div
        className={cn("text-[11px] font-bold uppercase text-ink-soft truncate")}
      >
        {title}
      </div>
    </div>
  </div>
);
