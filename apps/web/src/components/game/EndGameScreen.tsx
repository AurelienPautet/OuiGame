import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSocket, useAuth, useToast, TOAST_TYPES } from "../../contexts";
import { hexToDataUrl } from "../../utils/levelUtils";
import { useRateLevel, useLevelLeaderboard } from "../../hooks/api";
import type { WinnerPayload } from "@ouigame/shared/types";
import type { LevelDTO } from "@ouigame/shared/api";
import type { LevelStats } from "./CampaignInterstitial";
import { formatTimeSec } from "../../lib/formatTime";
import { CountUp } from "../../lib/motionComponents";
import { StarRating } from "../ui/primitives";
import {
  OverlayScrim,
  OverlayPanel,
  Stat,
  StatGrid,
  SectionCard,
  ScoreRow,
  LeaderRow,
  OverlayActions,
  type ResultTone,
} from "./overlay";
import {
  Clock,
  Crosshair,
  Target,
  Skull,
  Bomb,
  Hammer,
  Trophy,
} from "lucide-react";

/** Possible round outcomes shown by the end screen. */
export type GameResult = "win" | "lose" | "draw";

/**
 * Solo / campaign game-over payload produced by the GameEngine and threaded
 * down as `externalResult` (online mode reads the `winner` socket event
 * instead).
 */
export interface SoloGameResult {
  result: "win" | "lose";
  timeElapsed: number;
  gridId?: unknown;
  levelInfo?: {
    name?: string;
    creator?: string;
    thumbnail?: string | null;
  } | null;
  stats?: LevelStats;
}

// One row of the multiplayer post-round score table.
interface ScoreRowData {
  id: string;
  name: string;
  wins: number;
  kills: number;
  deaths: number;
  isWinner: boolean;
  hasHighestKills: boolean;
  hasHighestDeaths: boolean;
}

// Level metadata rendered in the footer (from prop / level_change_info event).
interface LevelInfoState {
  id: number | string | null;
  name: string;
  creator: string;
  thumbnail: string | null;
}

interface EndGameScreenProps {
  externalResult?: SoloGameResult | null;
  onReplay: () => void;
  onQuit: () => void;
  levelId?: number | null;
}

export const EndGameScreen = ({
  externalResult,
  onReplay,
  onQuit,
  levelId,
}: EndGameScreenProps) => {
  const { t } = useTranslation();
  const { socket } = useSocket()!;
  const { user } = useAuth();
  const { addToast } = useToast();

  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [resultName, setResultName] = useState(""); // Winner's name for lose case
  const [scores, setScores] = useState<ScoreRowData[]>([]);

  // Handle external result (Solo Mode)
  useEffect(() => {
    if (externalResult) {
      setResult(externalResult.result); // 'win' or 'lose'
      setVisible(true);

      const info = externalResult.levelInfo;
      if (info) {
        setLevelInfo((prev) => ({
          ...prev,
          name: info.name || t("common.unknown"),
          creator: info.creator || t("common.unknown"),
          thumbnail: info.thumbnail ? hexToDataUrl(info.thumbnail) : null,
        }));
      }
    } else {
      if (visible && !scores.length) {
        setVisible(false);
      }
    }
  }, [externalResult]);

  // Level info from level_change_info event
  const [levelInfo, setLevelInfo] = useState<LevelInfoState>({
    id: null,
    name: "",
    creator: "",
    thumbnail: null,
  });

  const [stars, setStars] = useState<number[]>([0, 0, 0, 0, 0]);

  const rateLevelMutation = useRateLevel();

  // Fetch level leaderboard for solo mode (best times)
  const { data: levelLeaderboard = [] } = useLevelLeaderboard(
    externalResult ? levelId : null,
    10
  );

  // Find current user's rank in leaderboard
  const myLeaderboardEntry = useMemo(() => {
    if (!user || !levelLeaderboard.length) return null;
    return levelLeaderboard.find((entry) => entry.username === user.username);
  }, [user, levelLeaderboard]);

  // Update levelInfo ID from prop if available (Solo Mode fix)
  useEffect(() => {
    if (levelId) {
      setLevelInfo((prev) => ({
        ...prev,
        id: levelId,
      }));
    }
  }, [levelId]);

  // Listen to level_change_info to get level info from DB
  useEffect(() => {
    if (!socket) return;

    const handleLevelChangeInfo = (levels: LevelDTO[]) => {
      if (levels && levels.length > 0) {
        const level = levels[0];
        if (!level) return;
        setLevelInfo({
          id: level.level_id,
          name: level.level_name || t("common.unknown"),
          creator: level.level_creator_name || t("common.unknown"),
          thumbnail: level.level_img ? hexToDataUrl(level.level_img) : null,
        });
        setStars([0, 0, 0, 0, 0]);
      }
    };

    socket.on("level_change_info", handleLevelChangeInfo);
    return () => {
      socket.off("level_change_info", handleLevelChangeInfo);
    };
  }, [socket, t]);

  // Handle winner event from server (multiplayer)
  useEffect(() => {
    if (!socket) return;

    const handleWinner = (data: WinnerPayload) => {
      const { socketid, waitingtime, player_scores, ids_to_name } = data;

      let resultType: GameResult;
      let winnerName = "";
      if (socketid === -1) {
        resultType = "draw";
      } else if (socketid === socket.id) {
        resultType = "win";
      } else {
        resultType = "lose";
        winnerName = ids_to_name[socketid] || t("common.unknown");
      }
      setResult(resultType);
      setResultName(winnerName);

      const highestWins = Math.max(
        ...Object.values(player_scores).map((s) => s.wins)
      );
      const highestKills = Math.max(
        ...Object.values(player_scores).map((s) => s.kills)
      );
      const highestDeaths = Math.max(
        ...Object.values(player_scores).map((s) => s.deaths)
      );

      const sortedScores = Object.entries(player_scores)
        .map(([id, score]) => ({
          id,
          name: ids_to_name[id] || `Player ${id.slice(-4)}`,
          wins: score.wins,
          kills: score.kills,
          deaths: score.deaths,
          isWinner: score.wins === highestWins,
          hasHighestKills: score.kills === highestKills,
          hasHighestDeaths: score.deaths === highestDeaths,
        }))
        .sort((a, b) => b.wins - a.wins);

      setScores(sortedScores);
      setVisible(true);

      setTimeout(() => {
        setVisible(false);
        setResult(null);
        setResultName("");
        setScores([]);
      }, waitingtime);
    };

    const handleYourRating = (serverStars: number | number[]) => {
      if (typeof serverStars === "number" && serverStars > 0) {
        const starsArray = [0, 1, 2, 3, 4].map((i) =>
          i < serverStars ? 1 : 0
        );
        setStars(starsArray);
      } else if (Array.isArray(serverStars)) {
        setStars(serverStars);
      }
    };

    socket.on("winner", handleWinner);
    socket.on("your_level_rating", handleYourRating);

    return () => {
      socket.off("winner", handleWinner);
      socket.off("your_level_rating", handleYourRating);
    };
  }, [socket, t]);

  useEffect(() => {
    if (rateLevelMutation.isSuccess) {
      const rate =
        rateLevelMutation.data?.stars || rateLevelMutation.variables?.stars;
      addToast(
        TOAST_TYPES.SUCCESS,
        t("endGame.success"),
        t("endGame.ratedToast", { count: rate })
      );
    }
    if (rateLevelMutation.isError) {
      addToast(
        TOAST_TYPES.ERROR,
        t("endGame.error"),
        t("endGame.cantRate", {
          error: rateLevelMutation.error?.message || t("common.unknownError"),
        })
      );
    }
  }, [rateLevelMutation.isSuccess, rateLevelMutation.isError, addToast, t]);

  // Rate the level (1-based). Falls back to a toast when not signed in.
  const handleRate = useCallback(
    (starCount: number) => {
      if (!user) {
        addToast(
          TOAST_TYPES.ERROR,
          t("endGame.error"),
          t("endGame.needLoginRate")
        );
        return;
      }
      if (!levelInfo.id) {
        addToast(
          TOAST_TYPES.ERROR,
          t("endGame.error"),
          t("endGame.noLevelRate")
        );
        return;
      }
      setStars([0, 1, 2, 3, 4].map((i) => (i < starCount ? 1 : 0)));
      rateLevelMutation.mutate({ levelId: levelInfo.id, stars: starCount });
    },
    [user, levelInfo.id, rateLevelMutation, addToast, t]
  );

  // Calculate accuracy
  const calculateAccuracy = (shots?: number, hits?: number): number => {
    if (!shots) return 0;
    return Math.round(((hits ?? 0) / shots) * 100);
  };

  if (!visible || !result) return null;

  const resultText = {
    win: t("endGame.youWon"),
    lose: resultName
      ? t("endGame.someoneWon", { name: resultName })
      : t("endGame.youLost"),
    draw: t("endGame.draw"),
  }[result];

  const tone: ResultTone = result;
  const resultIcon =
    result === "win" ? (
      <Trophy className="w-16 h-16 text-yellow-d" />
    ) : result === "lose" ? (
      <Skull className="w-16 h-16 text-red" />
    ) : (
      <Target className="w-16 h-16 text-yellow-d" />
    );

  const ratingValue = stars.filter((s) => s === 1).length;
  const stats = externalResult?.stats || {};
  const accuracy = calculateAccuracy(stats.shots, stats.hits);

  // Shared footer: level info + interactive star rating.
  const levelFooter = (
    <div className="flex flex-col items-center gap-2 w-full">
      {levelInfo.thumbnail && (
        <img
          src={levelInfo.thumbnail}
          alt={t("endGame.levelThumbnailAlt")}
          className="w-40 h-24 rounded-lg border-2 border-ink object-cover"
        />
      )}
      {levelInfo.name && (
        <div className="text-center leading-tight">
          <div className="font-bold">{levelInfo.name}</div>
          <div className="text-ink-soft text-sm">
            {t("common.by", { name: levelInfo.creator })}
          </div>
        </div>
      )}
      <StarRating
        value={ratingValue}
        size={28}
        disabled={!user}
        onRate={handleRate}
      />
    </div>
  );

  return (
    <OverlayScrim>
      <OverlayPanel
        tone={tone}
        icon={resultIcon}
        title={resultText}
        widthClassName="w-[28rem] max-w-[92%]"
        footer={
          externalResult ? (
            <OverlayActions onReplay={onReplay} onQuit={onQuit} />
          ) : undefined
        }
      >
        {externalResult ? (
          <>
            {/* Solo Mode: per-level stats */}
            <StatGrid cols={3}>
              <Stat
                layout="cell"
                icon={<Clock className="w-4 h-4 text-blue" />}
                label={t("stats.time")}
                value={formatTimeSec(externalResult.timeElapsed)}
              />
              <Stat
                layout="cell"
                icon={<Crosshair className="w-4 h-4 text-orange" />}
                label={t("stats.shots")}
                value={<CountUp value={stats.shots || 0} />}
              />
              <Stat
                layout="cell"
                icon={<Target className="w-4 h-4 text-green" />}
                label={t("stats.accuracy")}
                value={
                  <CountUp
                    value={accuracy}
                    format={(v) => `${Math.round(v)}%`}
                  />
                }
              />
              <Stat
                layout="cell"
                icon={<Skull className="w-4 h-4 text-red" />}
                label={t("stats.kills")}
                value={<CountUp value={stats.kills || 0} />}
              />
              <Stat
                layout="cell"
                icon={<Bomb className="w-4 h-4 text-purple" />}
                label={t("stats.bombs")}
                value={<CountUp value={stats.plants || 0} />}
              />
              <Stat
                layout="cell"
                icon={<Hammer className="w-4 h-4 text-yellow-d" />}
                label={t("stats.blocks")}
                value={<CountUp value={stats.blocksDestroyed || 0} />}
              />
            </StatGrid>

            {/* Level Leaderboard - Best Times */}
            {levelLeaderboard.length > 0 && (
              <SectionCard
                icon={<Trophy className="w-4 h-4 text-yellow-d" />}
                title={t("endGame.bestTimes")}
              >
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {levelLeaderboard.slice(0, 5).map((entry) => (
                    <LeaderRow
                      key={entry.rank}
                      rank={entry.rank}
                      username={entry.username}
                      time={formatTimeSec(Math.floor(entry.timeMs / 1000))}
                      isMe={!!user && entry.username === user.username}
                    />
                  ))}
                  {myLeaderboardEntry && myLeaderboardEntry.rank > 5 && (
                    <>
                      <div className="text-center text-xs text-ink/40">…</div>
                      <LeaderRow
                        rank={myLeaderboardEntry.rank}
                        username={myLeaderboardEntry.username}
                        time={formatTimeSec(
                          Math.floor(myLeaderboardEntry.timeMs / 1000)
                        )}
                        isMe
                      />
                    </>
                  )}
                </div>
              </SectionCard>
            )}
          </>
        ) : (
          /* Multiplayer Mode: post-round score table */
          <SectionCard
            icon={<Trophy className="w-4 h-4 text-yellow-d" />}
            title={t("endGame.results")}
          >
            {scores.map((score) => (
              <ScoreRow
                key={score.id}
                name={score.name}
                wins={score.wins}
                kills={score.kills}
                deaths={score.deaths}
                isWinner={score.isWinner}
                hasHighestKills={score.hasHighestKills}
                hasHighestDeaths={score.hasHighestDeaths}
              />
            ))}
          </SectionCard>
        )}

        {levelFooter}
      </OverlayPanel>
    </OverlayScrim>
  );
};
