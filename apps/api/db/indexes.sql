-- Idempotent indexes for the foreign-key columns we filter/group/join on.
-- These match the index() definitions added to the Drizzle schema. You can
-- either apply this file directly (psql "$DATABASE_URL" -f Server/db/indexes.sql)
-- or regenerate a proper migration with `npm run db:generate && npm run db:migrate`.

CREATE INDEX IF NOT EXISTS rounds_level_id_idx ON "OuiTank-rounds" (level_id);
CREATE INDEX IF NOT EXISTS rounds_player_id_idx ON "OuiTank-rounds" (player_id);
CREATE INDEX IF NOT EXISTS solo_rounds_level_id_idx ON "OuiTank-solo_rounds" (level_id);
CREATE INDEX IF NOT EXISTS solo_rounds_player_id_idx ON "OuiTank-solo_rounds" (player_id);
CREATE INDEX IF NOT EXISTS levels_creator_id_idx ON "OuiTank-levels" (creator_id);
CREATE INDEX IF NOT EXISTS levels_img_level_id_idx ON "OuiTank-levels_img" (level_id);
