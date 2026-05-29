import { useState } from "react";
import { Search, Layers, Plus } from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { useCampaigns, useMyCampaigns } from "../../hooks/api";

/**
 * CampaignSelector - Reusable campaign browser.
 *
 * @param {Object} props
 * @param {"play" | "my"} props.mode
 * @param {Function} props.onSelect - called with campaignId (play mode)
 * @param {Function} props.onEdit - called with campaignId (my mode)
 * @param {Function} props.onDelete - called with campaignId (my mode)
 * @param {Function} props.onCreate - called when "New Campaign" clicked (my mode)
 */
export function CampaignSelector({
  mode = "play",
  onSelect,
  onEdit,
  onDelete,
  onCreate,
}) {
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
      <div className="flex gap-4 mb-4 flex-wrap">
        <label className="input input-bordered flex items-center gap-2 flex-1 min-w-48 bg-base-200">
          <Search className="w-4 h-4 opacity-70" />
          <input
            type="text"
            className="grow bg-transparent"
            placeholder="Search campaign name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </label>

        {isMy && onCreate && (
          <button className="btn btn-primary gap-2" onClick={onCreate}>
            <Plus className="w-5 h-5" />
            New Campaign
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-base-content/50 py-8">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>
              {isMy
                ? "No campaigns yet. Create your first campaign!"
                : "No campaigns found"}
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
              onEdit={isMy ? onEdit : undefined}
              onDelete={isMy ? onDelete : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
