import { useState, useEffect, useCallback, useMemo } from "react";
import { useSocket, useAuth, useToast, TOAST_TYPES } from "../../contexts";
import { hexToDataUrl } from "../../utils/levelUtils";
import { useRateLevel, useLevelLeaderboard } from "../../hooks/api";
import {
  Clock,
  Crosshair,
  Target,
  Skull,
  Bomb,
  Hammer,
  RotateCcw,
  LogOut,
  Trophy,
  User,
} from "lucide-react";

export const EndGameScreen = ({
  externalResult,
  onReplay,
  onQuit,
  levelId,
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState(null); // 'win' | 'lose' | 'draw'
  const [resultName, setResultName] = useState(""); // Winner's name for lose case
  const [scores, setScores] = useState([]);

  // Handle external result (Solo Mode)
  useEffect(() => {
    if (externalResult) {
      setResult(externalResult.result); // 'win' or 'lose'
      setVisible(true);

      if (externalResult.levelInfo) {
        setLevelInfo((prev) => ({
          ...prev,
          name: externalResult.levelInfo.name || "Unknown",
          creator: externalResult.levelInfo.creator || "Unknown",
          thumbnail: externalResult.levelInfo.thumbnail
            ? hexToDataUrl(externalResult.levelInfo.thumbnail)
            : null,
        }));
      }
    } else {
      if (visible && !scores.length) {
        setVisible(false);
      }
    }
  }, [externalResult]);

  // Level info from level_change_info event
  const [levelInfo, setLevelInfo] = useState({
    id: null,
    name: "",
    creator: "",
    thumbnail: null,
  });

  const [stars, setStars] = useState([0, 0, 0, 0, 0]);
  const [hoveredStar, setHoveredStar] = useState(-1);

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

    const handleLevelChangeInfo = (levels) => {
      if (levels && levels.length > 0) {
        const level = levels[0];
        setLevelInfo({
          id: level.level_id || level.id,
          name: level.level_name || "Unknown",
          creator: level.level_creator_name || "Unknown",
          thumbnail: level.level_img ? hexToDataUrl(level.level_img) : null,
        });
        setStars([0, 0, 0, 0, 0]);
      }
    };

    socket.on("level_change_info", handleLevelChangeInfo);
    return () => socket.off("level_change_info", handleLevelChangeInfo);
  }, [socket]);

  // Handle winner event from server (multiplayer)
  useEffect(() => {
    if (!socket) return;

    const handleWinner = (data) => {
      const { socketid, waitingtime, player_scores, ids_to_name } = data;

      let resultType;
      let winnerName = "";
      if (socketid === -1) {
        resultType = "draw";
      } else if (socketid === socket.id) {
        resultType = "win";
      } else {
        resultType = "lose";
        winnerName = ids_to_name[socketid] || "Unknown";
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

    const handleYourRating = (serverStars) => {
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
  }, [socket]);

  useEffect(() => {
    if (rateLevelMutation.isSuccess) {
      const rate =
        rateLevelMutation.data?.stars || rateLevelMutation.variables?.stars;
      addToast(
        TOAST_TYPES.SUCCESS,
        "Success",
        `You rated the level with ${rate} stars`
      );
    }
    if (rateLevelMutation.isError) {
      addToast(
        TOAST_TYPES.ERROR,
        "Error",
        `Can't rate: ${rateLevelMutation.error?.message || "Unknown error"}`
      );
    }
  }, [rateLevelMutation.isSuccess, rateLevelMutation.isError, addToast]);

  const handleStarHover = useCallback(
    (index) => {
      if (!user) return;
      setHoveredStar(index);
    },
    [user]
  );

  const handleStarClick = useCallback(
    (index) => {
      if (!user) {
        addToast(
          TOAST_TYPES.ERROR,
          "Error",
          "You need to be logged in to rate a level"
        );
        return;
      }
      if (!levelInfo.id) {
        addToast(TOAST_TYPES.ERROR, "Error", "No level to rate");
        return;
      }
      const newStars = [0, 0, 0, 0, 0].map((_, i) => (i <= index ? 1 : 0));
      setStars(newStars);
      rateLevelMutation.mutate({ levelId: levelInfo.id, stars: index + 1 });
    },
    [user, levelInfo.id, rateLevelMutation, addToast]
  );

  const getDisplayedStars = useCallback(() => {
    if (hoveredStar >= 0) {
      return [0, 1, 2, 3, 4].map((i) => i <= hoveredStar);
    }
    return stars.map((s) => s === 1);
  }, [hoveredStar, stars]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate accuracy
  const calculateAccuracy = (shots, hits) => {
    if (shots === 0) return 0;
    return Math.round((hits / shots) * 100);
  };

  if (!visible) return null;

  const resultText = {
    win: "You Won!",
    lose: resultName ? `${resultName} Won :(` : "You Lost :(",
    draw: "Draw",
  }[result];

  const resultColor = {
    win: "text-green-500",
    lose: "text-red-500",
    draw: "text-yellow-500",
  }[result];

  const borderColor = {
    win: "border-green-500",
    lose: "border-red-500",
    draw: "border-yellow-500",
  }[result];

  const displayedStars = getDisplayedStars();
  const stats = externalResult?.stats || {};
  const accuracy = calculateAccuracy(stats.shots, stats.hits);

  return (
    <div
      className={`absolute inset-0 z-60 flex flex-col items-center justify-evenly border-8 ${borderColor} pointer-events-auto`}
    >
      {/* Result text */}
      <div className={`text-4xl font-bold ${resultColor}`}>{resultText}</div>

      {/* Solo Mode: Stats, Leaderboard and Buttons */}
      {externalResult ? (
        <div className="flex flex-col items-center gap-4 animate-fadeIn">
          {/* Stats Row with Icons */}
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {/* Time */}
            <div
              className="flex items-center gap-2 text-white"
              title="Time Elapsed"
            >
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="font-mono text-xl text-yellow-400">
                {formatTime(externalResult.timeElapsed)}
              </span>
            </div>

            {/* Shots */}
            <div
              className="flex items-center gap-2 text-white"
              title="Shots Fired"
            >
              <Crosshair className="w-5 h-5 text-orange-400" />
              <span className="font-mono text-xl">{stats.shots || 0}</span>
            </div>

            {/* Accuracy */}
            <div
              className="flex items-center gap-2 text-white"
              title="Accuracy"
            >
              <Target className="w-5 h-5 text-green-400" />
              <span className="font-mono text-xl">{accuracy}%</span>
            </div>

            {/* Kills */}
            <div className="flex items-center gap-2 text-white" title="Kills">
              <Skull className="w-5 h-5 text-red-400" />
              <span className="font-mono text-xl">{stats.kills || 0}</span>
            </div>

            {/* Bombs */}
            <div
              className="flex items-center gap-2 text-white"
              title="Bombs Planted"
            >
              <Bomb className="w-5 h-5 text-purple-400" />
              <span className="font-mono text-xl">{stats.plants || 0}</span>
            </div>

            {/* Blocks */}
            <div
              className="flex items-center gap-2 text-white"
              title="Blocks Destroyed"
            >
              <Hammer className="w-5 h-5 text-yellow-400" />
              <span className="font-mono text-xl">
                {stats.blocksDestroyed || 0}
              </span>
            </div>
          </div>

          {/* Level Leaderboard - Best Times */}
          {levelLeaderboard.length > 0 && (
            <div className="bg-black/40 rounded-lg p-3 max-w-md w-full">
              <div className="flex items-center gap-2 mb-2 text-white text-sm font-bold">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Best Times
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {levelLeaderboard.slice(0, 5).map((entry) => {
                  const isMe = user && entry.username === user.username;
                  return (
                    <div
                      key={entry.rank}
                      className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                        isMe
                          ? "bg-primary/30 text-primary-content"
                          : "text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 text-center font-bold ${
                            entry.rank === 1
                              ? "text-yellow-400"
                              : entry.rank === 2
                                ? "text-gray-400"
                                : entry.rank === 3
                                  ? "text-yellow-700"
                                  : ""
                          }`}
                        >
                          {entry.rank}
                        </span>
                        <User className="w-4 h-4" />
                        <span>{entry.username}</span>
                        {isMe && (
                          <span className="text-xs opacity-70">(you)</span>
                        )}
                      </div>
                      <span className="font-mono text-yellow-400">
                        {formatTime(Math.floor(entry.timeMs / 1000))}
                      </span>
                    </div>
                  );
                })}
                {/* Show user's rank if not in top 5 */}
                {myLeaderboardEntry && myLeaderboardEntry.rank > 5 && (
                  <>
                    <div className="text-center text-xs text-gray-500">...</div>
                    <div className="flex items-center justify-between text-sm px-2 py-1 rounded bg-primary/30 text-primary-content">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-bold">
                          {myLeaderboardEntry.rank}
                        </span>
                        <User className="w-4 h-4" />
                        <span>{myLeaderboardEntry.username}</span>
                        <span className="text-xs opacity-70">(you)</span>
                      </div>
                      <span className="font-mono text-yellow-400">
                        {formatTime(
                          Math.floor(myLeaderboardEntry.timeMs / 1000)
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onReplay}
              className="btn btn-success btn-lg text-white gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
            <button
              onClick={onQuit}
              className="btn btn-error btn-lg text-white gap-2"
            >
              <LogOut className="w-5 h-5" />
              Quit
            </button>
          </div>
        </div>
      ) : (
        /* Multiplayer Mode: Scores table */
        <div className="flex flex-col items-center justify-center w-full max-w-2xl gap-2">
          {scores.map((score, index) => (
            <div
              key={score.id}
              className="w-full text-xl font-bold flex items-center justify-center gap-2 animate-[scoreCascade_0.5s_ease-out_forwards] opacity-0"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <span
                className={score.isWinner ? "text-yellow-500" : "text-white"}
              >
                {score.name} : {score.wins}
              </span>
              <span className="text-gray-400">............</span>
              <span className="text-white">kills : </span>
              <span
                className={
                  score.hasHighestKills ? "text-green-500" : "text-white"
                }
              >
                {score.kills}
              </span>
              <span className="text-white ml-2">deaths : </span>
              <span
                className={
                  score.hasHighestDeaths ? "text-red-500" : "text-white"
                }
              >
                {score.deaths}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Level info and rating */}
      <div className="flex items-center justify-center gap-4 text-white text-xl font-bold">
        {levelInfo.thumbnail && (
          <img
            src={levelInfo.thumbnail}
            alt="Level thumbnail"
            className="w-32 h-20 rounded object-cover"
          />
        )}
        <span>{levelInfo.name}</span>
        <span className="text-gray-400">by</span>
        <span>{levelInfo.creator}</span>

        {/* Star rating */}
        <div className="flex gap-1" onMouseLeave={() => setHoveredStar(-1)}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`text-3xl cursor-pointer transition-all duration-150 hover:scale-110 ${
                displayedStars[i] ? "text-yellow-400" : "text-gray-500"
              } ${!user ? "cursor-not-allowed opacity-60" : ""}`}
              onMouseEnter={() => handleStarHover(i)}
              onClick={() => handleStarClick(i)}
            >
              ★
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
