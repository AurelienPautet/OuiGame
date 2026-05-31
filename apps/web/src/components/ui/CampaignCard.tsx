import { Layers, CheckCircle2, Pencil, Trash2, Trophy } from "lucide-react";
import { Button } from "./primitives";
import { cn } from "../../lib/cn";

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
      className="relative flex gap-4 p-3 rounded-xl cursor-pointer transition-all duration-150 bg-white border-[3px] border-ink shadow-[0_4px_0_rgba(0,0,0,0.12)] hover:-translate-y-0.5 group"
      onClick={onClick}
    >
      <div className="shrink-0 w-28 h-24 rounded-lg border-[3px] border-ink bg-field flex items-center justify-center">
        {completed ? (
          <Trophy className="w-12 h-12 text-yellow-d" />
        ) : (
          <Layers className="w-12 h-12 text-blue-d" />
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-ink truncate">{name}</h3>
            <span className="text-xs font-semibold text-blue-d truncate">
              by {author || "Unknown"} · {levelCount} level
              {levelCount === 1 ? "" : "s"}
            </span>
          </div>
          {completed && (
            <span className="inline-flex items-center gap-1 bg-green text-white text-xs font-bold border-2 border-ink rounded-full px-2 py-0.5 shrink-0">
              <CheckCircle2 size={12} strokeWidth={3} /> Done
            </span>
          )}
        </div>

        {description && (
          <p className="text-sm text-ink-soft line-clamp-2 mt-1">
            {description}
          </p>
        )}

        <div className="mt-2">
          <div className="flex justify-between text-xs font-semibold text-ink-soft mb-1">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 rounded-full border-2 border-ink bg-field overflow-hidden">
            <div
              className={cn("h-full", completed ? "bg-green" : "bg-blue")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {showActions && (
        <div className="absolute right-3 top-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="blue"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(campaignId);
              }}
            >
              <Pencil size={16} /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(campaignId);
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
