import { useState } from "react";
import { User, Trophy, Gamepad2 } from "lucide-react";
import { useModal, useAuth } from "../../contexts";
import { Tabs } from "../ui";
import {
  useRankings,
  usePersonalRank,
  useGlobalSoloLeaderboard,
} from "../../hooks/api";
import type { RankingType, SoloGlobalType } from "@ouigame/shared/api";

type Mode = "ONLINE" | "SOLO";

// Online ranking tabs
const ONLINE_TABS: { value: RankingType; label: string }[] = [
  { value: "KILLS", label: "Kills" },
  { value: "WINS", label: "Wins" },
  { value: "ROUNDS_PLAYED", label: "Rounds Played" },
];

// Solo ranking tabs
const SOLO_TABS: { value: SoloGlobalType; label: string }[] = [
  { value: "LEVELS_COMPLETED", label: "Levels Completed" },
  { value: "LEVELS_PLAYED", label: "Levels Played" },
  { value: "KILLS", label: "Kills" },
];

// Top-level mode tabs
const MODE_TABS: { value: Mode; label: string }[] = [
  { value: "ONLINE", label: "Online" },
  { value: "SOLO", label: "Solo" },
];

// Get display label for tab value
const getTabLabel = (value: string) => {
  const allTabs = [...ONLINE_TABS, ...SOLO_TABS];
  const tab = allTabs.find((t) => t.value === value);
  return tab ? tab.label : value.replace("_", " ");
};

export const RankingsModal = () => {
  const { closeModal } = useModal();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("ONLINE"); // ONLINE or SOLO
  const [onlineTab, setOnlineTab] = useState<RankingType>("KILLS");
  const [soloTab, setSoloTab] = useState<SoloGlobalType>("LEVELS_COMPLETED");

  // Active tab based on mode
  const activeTab = mode === "ONLINE" ? onlineTab : soloTab;
  // The Tabs component only emits values from the current mode's tab list, so
  // the cast to the mode-specific enum is safe.
  const setActiveTab = (value: string) => {
    if (mode === "ONLINE") {
      setOnlineTab(value as RankingType);
    } else {
      setSoloTab(value as SoloGlobalType);
    }
  };

  // React Query hooks for online rankings
  const { data: onlineRankings = [], isLoading: onlineLoading } =
    useRankings(onlineTab);
  const { data: personalOnlineRank } = usePersonalRank(onlineTab);

  // React Query hook for solo leaderboard with type
  const { data: soloRankings = [], isLoading: soloLoading } =
    useGlobalSoloLeaderboard(soloTab, 50);

  // Current rankings based on mode
  const rankings = mode === "ONLINE" ? onlineRankings : soloRankings;
  const isLoading = mode === "ONLINE" ? onlineLoading : soloLoading;

  // Find current user in solo leaderboard
  const personalSoloRank = user
    ? soloRankings.find((p) => p.username === user.username)
    : null;
  const personalRank =
    mode === "ONLINE" ? personalOnlineRank : personalSoloRank;

  const getRankBgClass = (rank: string | number) => {
    if (rank == 1) return "bg-yellow-500"; // Gold
    if (rank == 2) return "bg-zinc-500"; // Silver
    if (rank == 3) return "bg-yellow-700"; // Bronze
    return "bg-base-200";
  };

  const getRankTextClass = (rank: string | number) => {
    if (Number(rank) <= 3) return "text-white font-bold";
    return "";
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200 w-11/12 max-w-3xl h-3/4 p-0 overflow-hidden flex flex-col">
        <h1 className="text-center py-4 text-3xl font-bold">
          {mode === "ONLINE" ? "Online Rankings" : "Solo Leaderboard"}
        </h1>

        {/* Mode Toggle */}
        <div className="flex justify-center gap-2 px-4 pb-2">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`btn btn-sm ${mode === tab.value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode(tab.value)}
            >
              {tab.value === "ONLINE" ? (
                <Trophy size={16} className="mr-1" />
              ) : (
                <Gamepad2 size={16} className="mr-1" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs - different for each mode */}
        <Tabs
          tabs={mode === "ONLINE" ? ONLINE_TABS : SOLO_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Rankings List */}
        <div className="bg-base-100 flex-1 p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : rankings.length === 0 ? (
            <p className="text-center text-slate-400">No rankings available</p>
          ) : (
            <div className="space-y-2">
              {rankings.map((player) => (
                <div
                  key={player.username}
                  className={`flex items-center rounded-lg p-3 ${getRankBgClass(
                    player.rank
                  )} ${getRankTextClass(player.rank)}`}
                >
                  <span className="text-2xl w-12 text-center font-bold">
                    {player.rank}
                  </span>
                  <User className="w-10 h-10 mx-2" />
                  <span className="flex-1 font-semibold">
                    {player.username}
                  </span>
                  <span className="font-bold mr-4">
                    {player.total_data} {getTabLabel(activeTab)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal Rank Section */}
        <div className="bg-base-100 px-4 pb-4">
          <div className="divider my-2"></div>
          {user && personalRank ? (
            <div
              className={`flex items-center rounded-lg p-3 ${getRankBgClass(
                personalRank.rank
              )} ${getRankTextClass(personalRank.rank)}`}
            >
              <span className="text-2xl w-12 text-center font-bold">
                {personalRank.rank}
              </span>
              <User className="w-10 h-10 mx-2" />
              <span className="flex-1 font-semibold">
                {personalRank.username} (YOU)
              </span>
              <span className="font-bold mr-4">
                {personalRank.total_data} {getTabLabel(activeTab)}
              </span>
            </div>
          ) : (
            <div className="flex items-center bg-base-200 rounded-lg p-3">
              <span className="text-2xl w-12 text-center font-bold">XXX</span>
              <User className="w-10 h-10 mx-2 text-base-content/50" />
              <span className="flex-1 font-semibold text-base-content/70">
                {user
                  ? mode === "SOLO"
                    ? "Play solo to appear on leaderboard"
                    : "Play online to appear on leaderboard"
                  : "Login to see your rank"}
              </span>
              <span className="font-bold mr-4 text-base-content/50">
                XXX {getTabLabel(activeTab)}
              </span>
            </div>
          )}
        </div>

        <div className="bg-base-100 p-4 flex justify-center">
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
