const {
  pgTable,
  serial,
  integer,
  varchar,
  json,
  timestamp,
} = require("drizzle-orm/pg-core");
const { players } = require("./players");

// Append-only audit trail of privileged admin actions (role changes, level/
// campaign moderation, etc.). One row per action; `details` carries a free-form
// JSON payload describing what changed. `actorId` is nullable (ON DELETE SET
// NULL) so the log survives even if the acting admin's account is later removed.
const adminAuditLog = pgTable("OuiTank-admin_audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => players.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 60 }).notNull(),
  targetType: varchar("target_type", { length: 30 }),
  targetId: integer("target_id"),
  details: json("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

module.exports = { adminAuditLog };
