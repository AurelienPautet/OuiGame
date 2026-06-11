import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGame, useToast } from "../contexts";
import { campaignsApi } from "../api";

/**
 * Start a campaign run by id. A campaign has no playable grid of its own, so we
 * fetch its ordered level ids first, then hand them to GameContext.startCampaign.
 *
 * Shared by the "browse campaigns" and "my campaigns" modals so the fetch +
 * empty-check + error-toast flow can't drift between them. `start` takes an
 * optional `onStarted` callback (typically the modal's close handler), run only
 * once the run has actually begun.
 */
export function useStartCampaign() {
  const { startCampaign } = useGame();
  const { addToast, TOAST_TYPES } = useToast();
  const { t } = useTranslation();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const start = useCallback(
    async (campaignId: number, onStarted?: () => void) => {
      if (loadingId) return;
      setLoadingId(campaignId);
      try {
        const campaign = await campaignsApi.getCampaign(campaignId);
        const levelIds = (campaign.levels || []).map((l) => l.level_id);
        if (levelIds.length === 0) {
          addToast(
            TOAST_TYPES.ERROR,
            t("campaignEditor.toast.title"),
            t("campaignSelectorModal.noPlayableLevels")
          );
          setLoadingId(null);
          return;
        }
        startCampaign({ campaignId, levelIds });
        // No setLoadingId(null) on success: the run starts and the caller
        // unmounts the modal, so there's no button left to re-enable.
        onStarted?.();
      } catch (err) {
        console.error("Failed to start campaign:", err);
        addToast(
          TOAST_TYPES.ERROR,
          t("campaignEditor.toast.title"),
          t("campaignSelectorModal.failedStart")
        );
        setLoadingId(null);
      }
    },
    [loadingId, startCampaign, addToast, TOAST_TYPES, t]
  );

  return { start, loadingId };
}
