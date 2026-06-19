// Admin audit trail: every privileged action an admin performs is recorded in
// the adminAuditLog table. Kept deliberately small — callers pass the actor, a
// stable `action` string, and optionally what was targeted plus arbitrary
// `details` (serialized to the jsonb column by Drizzle).
import { db, schema } from "@ouigame/db";

const { adminAuditLog } = schema;

interface RecordAuditParams {
  actorId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: unknown;
}

// Insert one audit row. Optional keys are OMITTED when undefined (rather than
// set to undefined) so they fall back to the column defaults — required by
// exactOptionalPropertyTypes, which forbids passing `undefined` for an optional
// property.
async function recordAudit(params: RecordAuditParams): Promise<void> {
  const values: typeof adminAuditLog.$inferInsert = {
    actorId: params.actorId,
    action: params.action,
  };
  if (params.targetType !== undefined) values.targetType = params.targetType;
  if (params.targetId !== undefined) values.targetId = params.targetId;
  if (params.details !== undefined) values.details = params.details;

  await db.insert(adminAuditLog).values(values);
}

export { recordAudit };
