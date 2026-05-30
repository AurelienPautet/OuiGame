import {
  User,
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

export const ProfileModal = () => {
  const { closeModal } = useModal();
  const { user, logout } = useAuth();
  const { data: stats, isLoading } = usePlayerStats();
  const { data: soloStats, isLoading: soloLoading } = useMySoloStats();

  const handleLogout = () => {
    logout();
    closeModal();
  };

  // Multiplayer stats
  const s = stats || {};
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

  // Solo stats
  const solo = soloStats || {};
  const soloLevelsCompleted = Number(solo.levelsCompleted) || 0;
  const soloTotalRounds = Number(solo.totalRounds) || 0;
  const soloTotalWins = Number(solo.totalWins) || 0;
  const soloWinRate = solo.winRate ? `${solo.winRate}%` : "0%";
  const soloKills = Number(solo.totalKills) || 0;
  const soloDeaths = Number(solo.totalDeaths) || 0;
  const soloAccuracy = solo.avgAccuracy ? `${solo.avgAccuracy}%` : "0%";
  const soloKdRatio =
    soloDeaths > 0 ? (soloKills / soloDeaths).toFixed(2) : soloKills.toFixed(0);

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl h-3/4 bg-base-100 p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-6 pb-4 flex flex-col items-center justify-center text-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-primary text-primary-content rounded-full w-20 shadow-lg ring-4 ring-base-100 flex items-center justify-center">
              <User size={40} />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-extrabold text-base-content mb-1">
              {user?.username || "Guest"}
            </h2>
            <p className="flex items-center gap-2">
              <span className="badge badge-md badge-ghost gap-2 truncate max-w-xs">
                {user?.email || "No email"}
              </span>
            </p>
          </div>

          <button
            className="btn btn-error btn-sm btn-ghost gap-2 position-absolute top-4 right-4 absolute"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-6 min-h-0">
          {/* Solo Stats Section */}
          <div>
            <h3 className="font-bold mb-4 opacity-80 uppercase tracking-widest text-sm flex items-center gap-2">
              <Gamepad2 size={18} className="text-success" />
              Solo Performance
            </h3>

            {soloLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : soloTotalRounds > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Levels Completed"
                  value={soloLevelsCompleted}
                  icon={CheckCircle}
                  color="text-success"
                />
                <StatCard
                  title="Solo Rounds"
                  value={soloTotalRounds}
                  icon={Gamepad2}
                  color="text-info"
                />
                <StatCard
                  title="Victories"
                  value={soloTotalWins}
                  icon={Trophy}
                  color="text-warning"
                />
                <StatCard
                  title="Win Rate"
                  value={soloWinRate}
                  icon={TrendingUp}
                  color="text-success"
                />
                <StatCard
                  title="Solo Kills"
                  value={soloKills}
                  icon={Swords}
                  color="text-error"
                />
                <StatCard
                  title="Solo K/D"
                  value={soloKdRatio}
                  icon={Scale}
                  color="text-secondary"
                />
                <StatCard
                  title="Solo Accuracy"
                  value={soloAccuracy}
                  icon={Target}
                  color="text-primary"
                />
              </div>
            ) : (
              <div className="text-center py-4 text-base-content/50">
                <p>No solo games played yet. Try some solo levels!</p>
              </div>
            )}
          </div>

          {/* Multiplayer Stats Section */}
          <div>
            <h3 className="font-bold mb-4 opacity-80 uppercase tracking-widest text-sm flex items-center gap-2">
              <Swords size={18} className="text-error" />
              Multiplayer Statistics
            </h3>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : rounds > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Rounds Played"
                  value={rounds}
                  icon={Activity}
                  color="text-info"
                />
                <StatCard
                  title="Wins"
                  value={wins}
                  icon={Trophy}
                  color="text-warning"
                />
                <StatCard
                  title="Win Rate"
                  value={winRate}
                  icon={TrendingUp}
                  color="text-success"
                />

                <StatCard
                  title="Kills"
                  value={kills}
                  icon={Swords}
                  color="text-error"
                />
                <StatCard
                  title="Deaths"
                  value={deaths}
                  icon={Skull}
                  color="text-base-content"
                />
                <StatCard
                  title="K/D Ratio"
                  value={kdRatio}
                  icon={Scale}
                  color="text-secondary"
                />

                <StatCard
                  title="Shots Fired"
                  value={shots}
                  icon={Crosshair}
                  color="text-accent"
                />
                <StatCard
                  title="Hits"
                  value={hits}
                  icon={Target}
                  color="text-primary"
                />
                <StatCard
                  title="Accuracy"
                  value={accuracy}
                  icon={Target}
                  color="text-primary"
                />

                <StatCard
                  title="Mines Planted"
                  value={plants}
                  icon={Bomb}
                  color="text-error"
                />
                <StatCard
                  title="Blocks Broken"
                  value={blocks}
                  icon={Hammer}
                  color="text-warning"
                />
              </div>
            ) : (
              <div className="text-center py-4 text-base-content/50">
                <p>No multiplayer games played yet. Join a room!</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 modal-action p-4 pt-0 mt-0">
          <button className="btn" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-base-200 p-4 rounded-xl flex items-center gap-4 transition-all hover:bg-base-300">
    <div className={`p-3 rounded-lg bg-base-100 ${color} bg-opacity-10`}>
      <Icon size={24} className={color} />
    </div>
    <div>
      <div className="stat-value text-xl">{value}</div>
      <div className="stat-title text-xs font-bold opacity-60 uppercase">
        {title}
      </div>
    </div>
  </div>
);
