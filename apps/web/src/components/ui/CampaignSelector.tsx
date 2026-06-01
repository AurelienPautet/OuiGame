import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Layers, Plus } from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { useCampaigns, useMyCampaigns } from "../../hooks/api";
import { Input, Button } from "./primitives";

/**
 * CampaignSelector - Reusable campaign browser.
 */
interface CampaignSelectorProps {
  mode?: "play" | "my";
  onSelect?: (campaignId: number) => void; // play mode
  onEdit?: (campaignId: number) => void; // my mode
  onDelete?: (campaignId: number) => void; // my mode
  onCreate?: () => void; // "New Campaign" clicked (my mode)
}

export function CampaignSelector({
  mode = "play",
  onSelect,
  onEdit,
  onDelete,
  onCreate,
}: CampaignSelectorProps) {
  const { t } = useTranslation();
  const [searchName, setSearchName] = useState("");
  const isMy = mode === "my";

  const query = isMy
    ? useMyCampaigns({ name: searchName })
    : useCampaigns({ name: searchName });

  const campaigns = query.data || [];
  const isLoading = query.isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <Input
            className="pl-10"
            placeholder={t("campaignSelector.searchPlaceholder")}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        {isMy && onCreate && (
          <Button variant="green" onClick={onCreate}>
            <Plus size={20} /> {t("campaignSelector.newCampaign")}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {isLoading ? (
          <div className="text-center py-8 text-ink-soft">
            {t("campaignSelector.loadingCampaigns")}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-ink-soft py-8">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="font-semibold">
              {isMy
                ? t("campaignSelector.noCampaignsMine")
                : t("campaignSelector.noCampaigns")}
            </p>
          </div>
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.campaign_id}
              campaignId={c.campaign_id}
              name={c.campaign_name}
              description={c.campaign_description}
              levelCount={c.level_count || 0}
              completionPercent={c.completion_percent || 0}
              completed={c.completed || false}
              author={c.campaign_creator_name}
              onClick={() => (isMy ? undefined : onSelect?.(c.campaign_id))}
              {...(isMy && onEdit ? { onEdit } : {})}
              {...(isMy && onDelete ? { onDelete } : {})}
            />
          ))
        )}
      </div>
    </div>
  );
}
