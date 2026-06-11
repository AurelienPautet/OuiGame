import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { achievementsApi } from "../../api";
import { storage } from "../../lib/storage";
import { useToast } from "../../contexts/ToastContext";
import { achievementName } from "../../constants/achievements";
import i18n from "../../i18n";

/**
 * The current user's unlocked achievements (logged-in only). Refetches on mount
 * so the profile grid reflects unlocks earned during the session; the catalog of
 * locked + unlocked is merged client-side from constants/achievements.ts.
 */
export const useMyAchievements = () => {
  return useQuery({
    queryKey: ["achievements", "me"],
    queryFn: achievementsApi.getMine,
    enabled: storage.hasSession(),
    staleTime: 30 * 1000,
  });
};

/**
 * Returns a callback that toasts each newly-unlocked achievement and refreshes
 * the cached list. Used by the solo/campaign submit mutations, whose HTTP
 * responses carry the unlocked keys (the online path is handled in ToastContext
 * via the `achievements_unlocked` socket event).
 */
export const useNotifyAchievementUnlocks = () => {
  const { addToast, TOAST_TYPES } = useToast();
  const queryClient = useQueryClient();
  return useCallback(
    (keys: string[]) => {
      keys.forEach((key) =>
        addToast(
          TOAST_TYPES.ACHIEVEMENT,
          i18n.t("toasts.achievementUnlocked"),
          achievementName(key),
          3500
        )
      );
      if (keys.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["achievements", "me"] });
      }
    },
    [addToast, TOAST_TYPES, queryClient]
  );
};
