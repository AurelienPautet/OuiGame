// Campaigns orchestration: ownership checks, level-set rewrites, run recording,
// and composing the repo + format helpers into the wire shapes the client
// expects. No req/res here — the route maps results/errors to HTTP.
import * as repo from "../repositories/campaigns.repo";

// Controlled, route-mappable failures (vs. unexpected errors which bubble to the
// route's catch for the 409/500 mapping). `status` + `message` are mapped 1:1.
class ServiceError extends Error {
  status: number;
  isServiceError: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.isServiceError = true;
  }
}

// Raw campaign meta row shape (the fields formatCampaigns reads off the repo rows).
interface CampaignMetaRow {
  id: number;
  name: string;
  description: string;
  creatorId: number;
}

// Shape raw campaign meta rows into the wire `campaign_*` objects, attaching
// level counts and this player's completion. Anonymous => zero completion.
async function formatCampaigns(
  rows: CampaignMetaRow[],
  playerId: number | null
) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [creators, counts, completion] = await Promise.all([
    repo.getCreatorNames(rows.map((r) => r.creatorId)),
    repo.getLevelCounts(ids),
    repo.getCompletionByCampaign(ids, playerId),
  ]);

  return rows.map((row) => {
    const levelCount = counts.get(row.id) || 0;
    const comp = completion.get(row.id);
    const maxCleared = comp?.maxCleared || 0;
    return {
      campaign_id: row.id,
      campaign_name: row.name,
      campaign_description: row.description,
      campaign_creator_name: creators.get(row.creatorId) || "Unknown",
      level_count: levelCount,
      completion_percent:
        levelCount > 0
          ? Math.min(100, Math.round((maxCleared / levelCount) * 100))
          : 0,
      completed: comp?.anyCompleted || false,
    };
  });
}

// Ordered, still-playable levels of a campaign (for the run loop + editor).
async function getCampaignLevels(campaignId: number) {
  const rows = await repo.getCampaignLevels(campaignId);
  if (rows.length === 0) return [];

  const [creators, images] = await Promise.all([
    repo.getCreatorNames(rows.map((r) => r.creatorId)),
    repo.getImagesByLevelId(rows.map((r) => r.levelId)),
  ]);
  return rows.map((r) => ({
    level_id: r.levelId,
    level_name: r.name,
    level_creator_name: creators.get(r.creatorId) || "Unknown",
    level_img: images.get(r.levelId) ?? null,
    order_index: r.orderIndex,
  }));
}

// Keep only ids that are real, public (status 'up') solo levels, preserving the
// caller's order and dropping duplicates. Campaigns are played vs bots, so only
// solo levels are eligible.
async function filterSoloLevelIds(levelIds: unknown) {
  if (!Array.isArray(levelIds)) return [];
  const candidates = levelIds.filter((id) => Number.isInteger(id) && id > 0);
  if (candidates.length === 0) return [];
  const validIds = await repo.getValidSoloLevelIds([...new Set(candidates)]);
  const valid = new Set(validIds);
  const seen = new Set();
  const out = [];
  for (const id of levelIds) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// --- Use cases ---

async function listCampaigns(name: string, playerId: number | null) {
  const rows = await repo.listCampaigns(name);
  return formatCampaigns(rows, playerId);
}

async function listMyCampaigns(name: string, playerId: number) {
  const rows = await repo.listCampaignsByCreator(name, playerId);
  return formatCampaigns(rows, playerId);
}

// Campaign meta + ordered levels + this player's progress. Throws 404 if absent.
async function getCampaignDetail(campaignId: number, playerId: number | null) {
  const rows = await repo.getCampaignById(campaignId);
  if (rows.length === 0) {
    throw new ServiceError(404, "Campaign not found");
  }
  const [formatted] = await formatCampaigns(rows, playerId);
  const levels = await getCampaignLevels(campaignId);
  return { ...formatted, levels };
}

// Create a campaign owned by `creatorId`. Caller pre-validates name/description.
async function createCampaign({
  name,
  description,
  creatorId,
  levelIds,
}: {
  name: string;
  description: string;
  creatorId: number;
  levelIds: unknown;
}) {
  const ordered = await filterSoloLevelIds(levelIds);
  if (ordered.length < 1) {
    throw new ServiceError(
      400,
      "Campaign must contain at least one solo level"
    );
  }
  const campaignId = await repo.insertCampaign({
    name: name.trim(),
    description,
    creatorId,
  });
  await repo.insertCampaignLevels(campaignId, ordered);
  return { campaignId };
}

// Rename/reorder a campaign the caller owns. Throws 403 if not theirs, 400 if no
// valid levels remain.
async function updateCampaign({
  campaignId,
  name,
  description,
  playerId,
  levelIds,
}: {
  campaignId: number;
  name: string;
  description: string;
  playerId: number;
  levelIds: unknown;
}) {
  const existing = await repo.getOwnedCampaign(campaignId, playerId);
  if (existing.length === 0) {
    throw new ServiceError(403, "Not your campaign");
  }

  const ordered = await filterSoloLevelIds(levelIds);
  if (ordered.length < 1) {
    throw new ServiceError(
      400,
      "Campaign must contain at least one solo level"
    );
  }

  await repo.updateCampaign(campaignId, { name: name.trim(), description });
  await repo.replaceCampaignLevels(campaignId, ordered);
  return { campaignId };
}

// Delete a campaign the caller owns. Throws 403 if not theirs. Relies on ON
// DELETE CASCADE for runs + level links (single campaigns delete).
async function deleteCampaign(campaignId: number, playerId: number) {
  const existing = await repo.getOwnedCampaign(campaignId, playerId);
  if (existing.length === 0) {
    throw new ServiceError(403, "Not your campaign");
  }
  await repo.deleteCampaign(campaignId);
  return { success: true };
}

// Record a campaign run. Caller pre-validates field types/ranges. Throws 404 if
// the campaign doesn't exist. `playerId` is null for anonymous runs.
async function submitRun({
  campaignId,
  playerId,
  levelsCleared,
  livesLeft,
  completed,
  timeMs,
}: {
  campaignId: number;
  playerId: number | null;
  levelsCleared: number;
  livesLeft?: number | null;
  completed: boolean;
  timeMs: number;
}) {
  const exists = await repo.campaignExists(campaignId);
  if (exists.length === 0) {
    throw new ServiceError(404, "Campaign not found");
  }
  await repo.insertCampaignRun({
    playerId,
    campaignId,
    levelsCleared,
    livesLeft: livesLeft ?? 0,
    completed,
    timeMs,
  });
  return { success: true };
}

export {
  ServiceError,
  listCampaigns,
  listMyCampaigns,
  getCampaignDetail,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  submitRun,
};
