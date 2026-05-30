import { Layers, CheckCircle2, Pencil, Trash2, Trophy } from "lucide-react";

/**
 * CampaignCard - Displays a campaign preview with completion progress.
 */
interface CampaignCardProps {
  campaignId: number;
  name: string;
  description?: string;
  levelCount?: number;
  completionPercent?: number; // 0-100
  completed?: boolean; // finished a full run at least once
  author?: string;
  onClick?: () => void;
  onEdit?: (campaignId: number) => void; // shown as Edit button when provided
  onDelete?: (campaignId: number) => void; // shown as Delete button when provided
}

export function CampaignCard({
  campaignId,
  name,
  description,
  levelCount = 0,
  completionPercent = 0,
  completed = false,
  author,
  onClick,
  onEdit,
  onDelete,
}: CampaignCardProps) {
  const showActions = !!(onEdit || onDelete);
  const pct = Math.max(0, Math.min(100, completionPercent || 0));

  return (
    <div
      className="relative flex gap-4 p-4 rounded-lg cursor-pointer transition-all duration-200 bg-base-300 border-4 border-base-300 hover:bg-base-200 group"
      onClick={onClick}
    >
      {/* Icon block */}
      <div className="flex-shrink-0 w-32 h-24 rounded border-2 border-base-content/20 bg-base-100 flex items-center justify-center">
        {completed ? (
          <Trophy className="w-12 h-12 text-warning" />
        ) : (
          <Layers className="w-12 h-12 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold truncate">{name}</h3>
            <span className="text-xs text-base-content/50">
              by {author || "Unknown"} · {levelCount} level
              {levelCount === 1 ? "" : "s"}
            </span>
          </div>
          {completed && (
            <span className="badge badge-success gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          )}
        </div>

        {description && (
          <p className="text-sm text-base-content/70 line-clamp-2 mt-1">
            {description}
          </p>
        )}

        {/* Completion progress */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-base-content/60 mb-1">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <progress
            className={`progress w-full ${completed ? "progress-success" : "progress-primary"}`}
            value={pct}
            max="100"
          />
        </div>
      </div>

      {/* Action buttons (my campaigns mode) */}
      {showActions && (
        <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              className="btn btn-sm btn-primary gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(campaignId);
              }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              className="btn btn-sm btn-error btn-outline gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(campaignId);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
