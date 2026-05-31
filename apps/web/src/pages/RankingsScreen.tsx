import { useState } from "react";
import { useAuth } from "../contexts";
import {
  useRankings,
  usePersonalRank,
  useGlobalSoloLeaderboard,
} from "../hooks/api";
import type { RankingType, SoloGlobalType } from "@ouigame/shared/api";
import {
  IoTitle,
  DarkPanel,
  SegmentedControl,
  SectionLabel,
  TankAvatar,
} from "../components/ui/primitives";
import { palette } from "../theme/palette";
import { cn } from "../lib/cn";

type Mode = "ONLINE" | "SOLO";

const ONLINE_STATS = [
  { value: "KILLS" as const, label: "Kills" },
  { value: "WINS" as const, label: "Wins" },
  { value: "ROUNDS_PLAYED" as const, label: "Rounds" },
];
const SOLO_STATS = [
  { value: "LEVELS_COMPLETED" as const, label: "Completed" },
  { value: "LEVELS_PLAYED" as const, label: "Played" },
  { value: "KILLS" as const, label: "Kills" },
];

const statLabel = (value: string) =>
  [...ONLINE_STATS, ...SOLO_STATS].find((s) => s.value === value)?.label ??
  value.replace("_", " ");

const PODIUM_TANK = ["blue", "red", "green"];
const MEDAL_BG = [palette.yellow, "#dfe3e8", palette.orange];

interface RankRow {
  rank: number | string;
  username: string;
  total_data: number | string;
}

export const RankingsScreen = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("ONLINE");
  const [onlineStat, setOnlineStat] = useState<RankingType>("KILLS");
  const [soloStat, setSoloStat] = useState<SoloGlobalType>("LEVELS_COMPLETED");

  const { data: onlineRankings = [], isLoading: onlineLoading } =
    useRankings(onlineStat);
  const { data: personalOnlineRank } = usePersonalRank(onlineStat);
  const { data: soloRankings = [], isLoading: soloLoading } =
    useGlobalSoloLeaderboard(soloStat, 50);

  const rankings = (
    mode === "ONLINE" ? onlineRankings : soloRankings
  ) as RankRow[];
  const isLoading = mode === "ONLINE" ? onlineLoading : soloLoading;
  const activeStat = mode === "ONLINE" ? onlineStat : soloStat;

  const personalSolo = user
    ? (soloRankings as RankRow[]).find((p) => p.username === user.username)
    : undefined;
  const personalRank =
    mode === "ONLINE"
      ? (personalOnlineRank as RankRow | undefined)
      : personalSolo;

  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);
  const maxData = rankings.reduce(
    (m, p) => Math.max(m, Number(p.total_data)),
    1
  );

  // Render order puts #1 in the middle, raised.
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="pt-6">
      <div className="flex items-center gap-3.5 flex-wrap mb-4">
        <IoTitle as="h1" className="text-4xl">
          RANKINGS
        </IoTitle>
        <SectionLabel>season 7 · live</SectionLabel>
      </div>

      <div className="flex gap-3.5 flex-wrap items-center mb-5">
        <SegmentedControl<Mode>
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "ONLINE", label: "Online" },
            { value: "SOLO", label: "Solo" },
          ]}
          aria-label="Ranking mode"
        />
        <SegmentedControl<string>
          tone="yellow"
          value={activeStat}
          onValueChange={(v) =>
            mode === "ONLINE"
              ? setOnlineStat(v as RankingType)
              : setSoloStat(v as SoloGlobalType)
          }
          options={mode === "ONLINE" ? ONLINE_STATS : SOLO_STATS}
          aria-label="Ranking stat"
        />
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="flex justify-center items-end gap-4 my-7 flex-wrap">
          {podiumOrder.map((p) => {
            if (!p) return null;
            const place = Number(p.rank);
            const first = place === 1;
            return (
              <div
                key={p.username}
                className={cn(
                  "relative bg-white border-4 border-ink rounded-[18px] shadow-arcade text-center px-4 pt-7 pb-4",
                  first ? "w-[230px] -translate-y-3.5" : "w-[200px]"
                )}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 -top-5 flex items-center justify-center rounded-full border-4 border-ink font-bold text-ink"
                  style={{
                    width: first ? 52 : 44,
                    height: first ? 52 : 44,
                    background: MEDAL_BG[place - 1] ?? "#dfe3e8",
                  }}
                >
                  {place}
                </div>
                <div className="flex justify-center my-2">
                  <TankAvatar
                    bodyColor={PODIUM_TANK[place - 1] ?? "blue"}
                    size={first ? 76 : 60}
                  />
                </div>
                <div className="text-lg font-bold truncate">{p.username}</div>
                <div
                  className={cn(
                    "font-bold text-blue-d",
                    first ? "text-4xl" : "text-3xl"
                  )}
                >
                  {p.total_data}
                </div>
                <div className="text-xs text-ink-soft font-semibold uppercase tracking-wide">
                  {statLabel(activeStat)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranked list #4+ */}
      <DarkPanel className="p-2">
        {isLoading ? (
          <p className="text-center text-white/60 py-8">Loading rankings…</p>
        ) : rankings.length === 0 ? (
          <p className="text-center text-white/60 py-8">
            No rankings available
          </p>
        ) : (
          rest.map((p) => (
            <div
              key={p.username}
              className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl odd:bg-white/5 hover:bg-white/10"
            >
              <span className="text-xl font-bold text-white w-10 text-center">
                #{p.rank}
              </span>
              <TankAvatar bodyColor="blue" size={34} />
              <span className="flex-1 text-white font-semibold truncate">
                {p.username}
              </span>
              <div className="hidden sm:block w-48 h-3.5 rounded-lg border-2 border-ink bg-white/10 overflow-hidden">
                <span
                  className="block h-full bg-blue"
                  style={{
                    width: `${Math.max(6, (Number(p.total_data) / maxData) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-yellow font-bold w-16 text-right">
                {p.total_data}
              </span>
            </div>
          ))
        )}
      </DarkPanel>

      {/* Your rank */}
      <div className="sticky bottom-3.5 mt-3.5 flex items-center gap-3.5 bg-yellow border-4 border-ink rounded-[14px] shadow-[0_8px_0_rgba(0,0,0,0.25)] px-4 py-3">
        <span className="text-xl font-bold text-ink w-12 text-center">
          {personalRank ? `#${personalRank.rank}` : "—"}
        </span>
        <TankAvatar bodyColor="orange" size={34} />
        <div className="flex-1 text-ink font-semibold flex items-center gap-2">
          {personalRank?.username ?? user?.username ?? "Guest"}
          <span className="bg-ink text-white text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-md uppercase">
            You
          </span>
        </div>
        <span className="text-ink font-bold">
          {personalRank
            ? `${personalRank.total_data} ${statLabel(activeStat)}`
            : user
              ? `Play ${mode === "SOLO" ? "solo" : "online"} to rank`
              : "Log in to rank"}
        </span>
      </div>
    </div>
  );
};
