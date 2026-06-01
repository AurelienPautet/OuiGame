import { useTranslation } from "react-i18next";
import { Trophy, Skull, Clock, Layers, Heart } from "lucide-react";
import { formatTimeMs } from "../../lib/formatTime";
import { OverlayScrim, OverlayPanel, Stat, OverlayActions } from "./overlay";

/**
 * Terminal result of a campaign run, computed by GameContext's run state
 * machine (campaignAdvance / campaignLoseLife) and stored on
 * `campaignRunResult`.
 */
export interface CampaignRunResult {
  completed: boolean;
  levelsCleared: number;
  livesLeft: number;
  timeMs: number;
}

/**
 * CampaignEndScreen - shown when a campaign run ends (completed or out of lives).
 */
interface CampaignEndScreenProps {
  result: CampaignRunResult | null;
  totalLevels: number;
  /** restart the campaign from level 1 */
  onReplay: () => void;
  onQuit: () => void;
}

export const CampaignEndScreen = ({
  result,
  totalLevels,
  onReplay,
  onQuit,
}: CampaignEndScreenProps) => {
  const { t } = useTranslation();
  if (!result) return null;
  const { completed, levelsCleared, livesLeft, timeMs } = result;

  return (
    <OverlayScrim>
      <OverlayPanel
        tone={completed ? "win" : "lose"}
        icon={
          completed ? (
            <Trophy className="w-16 h-16 text-yellow-d" />
          ) : (
            <Skull className="w-16 h-16 text-red" />
          )
        }
        title={completed ? t("campaignEnd.complete") : t("campaignEnd.runOver")}
        subtitle={
          completed ? t("campaignEnd.completeSub") : t("campaignEnd.runOverSub")
        }
        footer={<OverlayActions onReplay={onReplay} onQuit={onQuit} />}
      >
        <div className="w-full flex flex-col gap-2">
          <Stat
            icon={<Layers className="w-5 h-5 text-blue" />}
            label={t("campaignEnd.levelsCleared")}
            value={`${levelsCleared} / ${totalLevels}`}
          />
          <Stat
            icon={<Heart className="w-5 h-5 text-red" />}
            label={t("campaignEnd.livesLeft")}
            value={livesLeft}
          />
          <Stat
            icon={<Clock className="w-5 h-5 text-blue" />}
            label={t("campaignEnd.totalTime")}
            value={formatTimeMs(timeMs)}
          />
        </div>
      </OverlayPanel>
    </OverlayScrim>
  );
};
