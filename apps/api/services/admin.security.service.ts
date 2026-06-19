// Admin security service — orchestration + shaping for the login attempt log
// and the admin action audit trail. Builds the filter WHERE clauses via the
// repo, runs the page + count queries, coerces aggregate counts to plain
// numbers, and serializes timestamps to ISO strings, returning the exact wire
// DTOs the routes hand back. No req/res here.
import type {
  AdminLoginsResponse,
  AdminAuditResponse,
} from "@ouigame/shared/api";
import * as repo from "../repositories/admin.security.repo";

// A page of login attempts matching the optional search (username OR ip) and
// status (substring) filters, newest first.
async function listLogins({
  search,
  status,
  page,
  pageSize,
}: {
  search: string | undefined;
  status: string | undefined;
  page: number;
  pageSize: number;
}): Promise<AdminLoginsResponse> {
  const where = repo.loginsWhere(search, status);
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    repo.listLogins(where, pageSize, offset),
    repo.countLogins(where),
  ]);

  return {
    logins: rows.map((r) => ({
      id: r.id,
      username: r.username,
      ip: r.ip,
      status: r.status,
      at: (r.at ?? new Date(0)).toISOString(),
    })),
    total: Number(total) || 0,
    page,
    pageSize,
  };
}

// A page of admin audit-log entries matching the optional action search,
// newest first. `details` rides through untouched (free-form JSON).
async function listAudit({
  search,
  page,
  pageSize,
}: {
  search: string | undefined;
  page: number;
  pageSize: number;
}): Promise<AdminAuditResponse> {
  const where = repo.auditWhere(search);
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    repo.listAudit(where, pageSize, offset),
    repo.countAudit(where),
  ]);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      actorName: r.actorName,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      details: r.details,
      at: (r.at ?? new Date(0)).toISOString(),
    })),
    total: Number(total) || 0,
    page,
    pageSize,
  };
}

export { listLogins, listAudit };
