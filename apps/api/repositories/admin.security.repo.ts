// Admin security domain repository — PURE Drizzle queries for the login attempt
// log and the admin action audit trail. No req/res, no business rules; the
// service coerces aggregate counts to numbers and serializes dates to ISO
// strings. The login/audit rows are LEFT-JOINed to players for the (nullable)
// username/actor name so a row survives even after its player is removed.
import { db, schema } from "@ouigame/db";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

const { logings, adminAuditLog, players } = schema;

// One page of login attempts (newest first), each with the (nullable) username
// resolved via LEFT JOIN. `where` is the filter the service built from the
// search/status query (or undefined for "all").
async function listLogins(
  where: SQL | undefined,
  limit: number,
  offset: number
) {
  return db
    .select({
      id: logings.id,
      username: players.username,
      ip: logings.ipAddress,
      status: logings.status,
      at: logings.attemptTimestamp,
    })
    .from(logings)
    .leftJoin(players, eq(logings.playerId, players.id))
    .where(where)
    .orderBy(desc(logings.attemptTimestamp))
    .limit(limit)
    .offset(offset);
}

// Total login attempts matching the same filter (the pagination denominator).
async function countLogins(where: SQL | undefined) {
  const rows = await db
    .select({ total: count() })
    .from(logings)
    .leftJoin(players, eq(logings.playerId, players.id))
    .where(where);
  // count() with no GROUP BY always yields exactly one row.
  return rows[0]!.total;
}

// Build the WHERE for the login list: optional case-insensitive status
// substring match AND an optional search across username OR ip. Returns
// undefined when there are no filters (list everything).
function loginsWhere(search: string | undefined, status: string | undefined) {
  const conditions: SQL[] = [];
  if (status) conditions.push(ilike(logings.status, `%${status}%`));
  if (search) {
    const term = `%${search}%`;
    const searchClause = or(
      ilike(players.username, term),
      ilike(logings.ipAddress, term)
    );
    if (searchClause) conditions.push(searchClause);
  }
  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

// One page of audit-log entries (newest first), each with the (nullable) actor
// name resolved via LEFT JOIN on actorId.
async function listAudit(
  where: SQL | undefined,
  limit: number,
  offset: number
) {
  return db
    .select({
      id: adminAuditLog.id,
      actorName: players.username,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      details: adminAuditLog.details,
      at: adminAuditLog.timestamp,
    })
    .from(adminAuditLog)
    .leftJoin(players, eq(adminAuditLog.actorId, players.id))
    .where(where)
    .orderBy(desc(adminAuditLog.timestamp))
    .limit(limit)
    .offset(offset);
}

// Total audit entries matching the same filter.
async function countAudit(where: SQL | undefined) {
  const rows = await db
    .select({ total: count() })
    .from(adminAuditLog)
    .leftJoin(players, eq(adminAuditLog.actorId, players.id))
    .where(where);
  return rows[0]!.total;
}

// Build the WHERE for the audit list: optional case-insensitive action
// substring match. undefined when there is no search.
function auditWhere(search: string | undefined) {
  if (!search) return undefined;
  return ilike(adminAuditLog.action, `%${search}%`);
}

export {
  listLogins,
  countLogins,
  loginsWhere,
  listAudit,
  countAudit,
  auditWhere,
};
