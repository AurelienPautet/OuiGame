import { z } from "zod";

// Wire contracts for the admin dashboard. Every endpoint here is gated behind
// the `is_admin` flag on the player. Counts are real numbers (server-side
// Number()/COUNT() coerced), dates are ISO strings, and free-form `details`
// payloads (audit log) ride as z.unknown(). Request schemas parse req.query /
// req.body / req.params, hence the z.coerce.number() on numeric params.

// --- Response DTOs ------------------------------------------------------------

// GET /api/admin/overview — the headline dashboard. A flat bag of nested
// metric groups, each computed by aggregate queries at request time.
export const AdminOverviewSchema = z.object({
  players: z.object({
    total: z.number(),
    db: z.number(),
    google: z.number(),
    admins: z.number(),
    newToday: z.number(),
    new7d: z.number(),
    new30d: z.number(),
    activeToday: z.number(),
    active7d: z.number(),
    active30d: z.number(),
  }),
  content: z.object({
    levels: z.number(),
    levelsUp: z.number(),
    levelsDown: z.number(),
    campaigns: z.number(),
    ratings: z.number(),
  }),
  games: z.object({
    onlineRounds: z.number(),
    soloRounds: z.number(),
    campaignRuns: z.number(),
    total: z.number(),
  }),
  combat: z.object({
    kills: z.number(),
    deaths: z.number(),
    wins: z.number(),
    shots: z.number(),
    hits: z.number(),
    // 0..1 float (hits / shots).
    accuracy: z.number(),
    blocksDestroyed: z.number(),
    plants: z.number(),
  }),
  solo: z.object({
    completions: z.number(),
    attempts: z.number(),
    completionRate: z.number(),
    distinctLevelsCompleted: z.number(),
  }),
  campaignsStats: z.object({
    runs: z.number(),
    completions: z.number(),
    completionRate: z.number(),
  }),
  achievements: z.object({
    unlocked: z.number(),
  }),
  logins: z.object({
    total: z.number(),
    success: z.number(),
    failed: z.number(),
    successRate: z.number(),
  }),
  generatedAt: z.string(),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

// GET /api/admin/timeseries — one row per UTC day in the requested window.
export const AdminTimeseriesPointSchema = z.object({
  date: z.string(),
  newUsers: z.number(),
  activeUsers: z.number(),
  logins: z.number(),
  failedLogins: z.number(),
  onlineRounds: z.number(),
  soloRounds: z.number(),
  campaignRuns: z.number(),
  games: z.number(),
  kills: z.number(),
  levelsCreated: z.number(),
});
export type AdminTimeseriesPoint = z.infer<typeof AdminTimeseriesPointSchema>;

export const AdminTimeseriesSchema = z.array(AdminTimeseriesPointSchema);
export type AdminTimeseries = AdminTimeseriesPoint[];

// GET /api/admin/users — paginated user table; the per-row aggregates are
// LEFT-JOIN counts.
export const AdminUserListItemSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  type: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  onlineRounds: z.number(),
  soloRounds: z.number(),
  kills: z.number(),
  wins: z.number(),
  levelsCreated: z.number(),
  campaignsCreated: z.number(),
  achievements: z.number(),
});
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AdminUsersResponseSchema = z.object({
  users: z.array(AdminUserListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;

// GET /api/admin/users/:id — a single user's full profile: the list-item
// fields plus deeper combat totals and related-entity collections.
export const AdminUserDetailSchema = AdminUserListItemSchema.extend({
  deaths: z.number(),
  shots: z.number(),
  hits: z.number(),
  accuracy: z.number(),
  blocksDestroyed: z.number(),
  soloCompletions: z.number(),
  campaignRuns: z.number(),
  recentLogins: z.array(
    z.object({
      ip: z.string(),
      status: z.string(),
      at: z.string(),
    })
  ),
  levels: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      status: z.string(),
      type: z.string(),
      createdAt: z.string(),
    })
  ),
  campaigns: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      createdAt: z.string(),
    })
  ),
  achievements: z.array(z.string()),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

// GET /api/admin/levels — paginated level catalog with play/rating aggregates.
export const AdminLevelListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  maxPlayers: z.number(),
  creatorName: z.string().nullable(),
  createdAt: z.string(),
  plays: z.number(),
  rating: z.number().nullable(),
  ratingCount: z.number(),
});
export type AdminLevelListItem = z.infer<typeof AdminLevelListItemSchema>;

export const AdminLevelsResponseSchema = z.object({
  levels: z.array(AdminLevelListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminLevelsResponse = z.infer<typeof AdminLevelsResponseSchema>;

// GET /api/admin/campaigns — paginated campaign catalog with run aggregates.
export const AdminCampaignListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  creatorName: z.string().nullable(),
  createdAt: z.string(),
  levelCount: z.number(),
  runs: z.number(),
  completions: z.number(),
});
export type AdminCampaignListItem = z.infer<typeof AdminCampaignListItemSchema>;

export const AdminCampaignsResponseSchema = z.object({
  campaigns: z.array(AdminCampaignListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminCampaignsResponse = z.infer<
  typeof AdminCampaignsResponseSchema
>;

// GET /api/admin/logins — paginated login attempt log.
export const AdminLoginItemSchema = z.object({
  id: z.number(),
  username: z.string().nullable(),
  ip: z.string(),
  status: z.string(),
  at: z.string(),
});
export type AdminLoginItem = z.infer<typeof AdminLoginItemSchema>;

export const AdminLoginsResponseSchema = z.object({
  logins: z.array(AdminLoginItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminLoginsResponse = z.infer<typeof AdminLoginsResponseSchema>;

// GET /api/admin/audit — paginated admin action audit trail. `details` is a
// free-form JSON payload, so it stays z.unknown() on the wire.
export const AdminAuditItemSchema = z.object({
  id: z.number(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.number().nullable(),
  details: z.unknown(),
  at: z.string(),
});
export type AdminAuditItem = z.infer<typeof AdminAuditItemSchema>;

export const AdminAuditResponseSchema = z.object({
  entries: z.array(AdminAuditItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminAuditResponse = z.infer<typeof AdminAuditResponseSchema>;

// --- Request schemas (parse req.query / req.body / req.params) -----------------

// GET /api/admin/timeseries?days= — window length in days.
export const AdminTimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30).optional(),
});
export type AdminTimeseriesQuery = z.infer<typeof AdminTimeseriesQuerySchema>;

// GET /api/admin/users?search=&sort=&order=&type=&page=&pageSize=
export const AdminUsersQuerySchema = z.object({
  search: z.string().optional(),
  sort: z
    .enum(["created", "username", "kills", "wins", "rounds", "levels"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  type: z.enum(["db", "google"]).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).optional(),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

// PATCH /api/admin/users/:id — promote/demote.
export const AdminUpdateUserRequestSchema = z.object({
  isAdmin: z.boolean().optional(),
});
export type AdminUpdateUserRequest = z.infer<
  typeof AdminUpdateUserRequestSchema
>;

// Shared base for the simple paginated+searchable list endpoints.
export const AdminPagedQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).optional(),
});
export type AdminPagedQuery = z.infer<typeof AdminPagedQuerySchema>;

// GET /api/admin/levels — paged query plus status filter and sort controls.
export const AdminLevelsQuerySchema = AdminPagedQuerySchema.extend({
  status: z.enum(["up", "down"]).optional(),
  sort: z.enum(["created", "plays", "rating", "name"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
export type AdminLevelsQuery = z.infer<typeof AdminLevelsQuerySchema>;

// PATCH /api/admin/levels/:id — moderate (publish/unpublish).
export const AdminUpdateLevelRequestSchema = z.object({
  status: z.enum(["up", "down"]).optional(),
});
export type AdminUpdateLevelRequest = z.infer<
  typeof AdminUpdateLevelRequestSchema
>;

// GET /api/admin/logins — paged query plus an optional status filter.
export const AdminLoginsQuerySchema = AdminPagedQuerySchema.extend({
  status: z.string().optional(),
});
export type AdminLoginsQuery = z.infer<typeof AdminLoginsQuerySchema>;

// :id route param, coerced from the URL string.
export const AdminIdParamSchema = z.object({
  id: z.coerce.number().int(),
});
export type AdminIdParam = z.infer<typeof AdminIdParamSchema>;
