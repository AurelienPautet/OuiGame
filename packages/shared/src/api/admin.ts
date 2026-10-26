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
    guestsToday: z.number().default(0),
    connected: z
      .object({
        total: z.number(),
        registered: z.number(),
        guests: z.number(),
      })
      .default({ total: 0, registered: 0, guests: 0 }),
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
  // Playtime in milliseconds: `totalMs` = solo + online level time, while
  // `sessionMs` is total connected time (includes menus and lobby).
  playtime: z.object({
    soloMs: z.number(),
    onlineMs: z.number(),
    sessionMs: z.number(),
    totalMs: z.number(),
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
  activeGuests: z.number().default(0),
  activeRegistered: z.number().default(0),
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
  // Total level time (online + solo/campaign) and total connected time, both
  // in milliseconds.
  timePlayedMs: z.number(),
  sessionTimeMs: z.number(),
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

// GET /api/admin/connected-players — real-time snapshot of sockets currently connected.
export const AdminConnectedPlayerSchema = z.object({
  socketId: z.string(),
  clientId: z.string().nullable().optional(),
  type: z.enum(["registered", "guest"]),
  connectedAt: z.string(),
  durationMs: z.number(),
  ip: z.string().nullable().optional(),
  status: z.enum(["lobby", "playing", "in_room"]),
  room: z
    .object({
      id: z.number(),
      name: z.string(),
      mode: z.string().optional(),
      status: z.string().optional(),
    })
    .nullable()
    .optional(),
  user: z
    .object({
      id: z.number(),
      username: z.string(),
      email: z.string(),
      isAdmin: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  guestName: z.string().nullable().optional(),
});
export type AdminConnectedPlayer = z.infer<typeof AdminConnectedPlayerSchema>;

export const AdminConnectedPlayersResponseSchema = z.object({
  total: z.number(),
  registeredCount: z.number(),
  guestCount: z.number(),
  players: z.array(AdminConnectedPlayerSchema),
});
export type AdminConnectedPlayersResponse = z.infer<
  typeof AdminConnectedPlayersResponseSchema
>;

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

// GET /api/admin/levels/thumbnails — paged level layouts the client re-renders
// thumbnails from. `content` is the raw Drizzle json column (the stored
// `{ data: number[] }` envelope), so it stays z.unknown() on the wire.
export const AdminLevelThumbnailSourceSchema = z.object({
  id: z.number(),
  name: z.string(),
  content: z.unknown(),
});
export type AdminLevelThumbnailSource = z.infer<
  typeof AdminLevelThumbnailSourceSchema
>;

export const AdminLevelThumbnailsResponseSchema = z.object({
  levels: z.array(AdminLevelThumbnailSourceSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AdminLevelThumbnailsResponse = z.infer<
  typeof AdminLevelThumbnailsResponseSchema
>;

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

export const AdminTimeseriesRangeSchema = z.enum(["24h", "7d", "30d", "90d"]);
export type AdminTimeseriesRange = z.infer<typeof AdminTimeseriesRangeSchema>;

// GET /api/admin/timeseries?days=&range= — window length in days or named range ("24h" gives hourly series).
export const AdminTimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  range: AdminTimeseriesRangeSchema.optional(),
});
export type AdminTimeseriesQuery = z.infer<typeof AdminTimeseriesQuerySchema>;

// GET /api/admin/connected-players?type=&search=
export const AdminConnectedPlayersQuerySchema = z.object({
  type: z.enum(["all", "registered", "guest"]).optional(),
  search: z.string().optional(),
});
export type AdminConnectedPlayersQuery = z.infer<
  typeof AdminConnectedPlayersQuerySchema
>;

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

// PUT /api/admin/levels/:id/thumbnail — replace one level's stored thumbnail
// with freshly rendered bytes (hex-encoded JPEG, as produced by the client
// renderer). Capped well above a real 1150×800 thumbnail (< 1 MB hex) so a
// malformed client can't push an arbitrarily large blob through.
export const AdminUpdateLevelThumbnailRequestSchema = z.object({
  hexData: z
    .string()
    .regex(/^(?:[0-9a-f]{2})+$/i, "hexData must be an even-length hex string")
    .max(2_000_000, "hexData is too large"),
});
export type AdminUpdateLevelThumbnailRequest = z.infer<
  typeof AdminUpdateLevelThumbnailRequestSchema
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
