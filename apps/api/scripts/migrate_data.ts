/**
 * Data Migration Script
 * Migrates data from old tables to new OuiTank-* tables
 * Run after: pnpm db:migrate
 *
 * Standalone one-off script: load the root .env ourselves (the @ouigame/db
 * connection no longer loads dotenv — env is the caller's responsibility).
 */

// MUST be first: load the root .env before @ouigame/db creates its pool.
import "../env";

import { db } from "@ouigame/db";
import { sql } from "drizzle-orm";

async function migrateData() {
  console.log("═══════════════════════════════════════════");
  console.log("  Migrating data to OuiTank-* tables");
  console.log("═══════════════════════════════════════════");
  console.log("");

  try {
    // Migrate in correct order (respecting foreign keys)
    console.log("1. Migrating players...");
    await db.execute(sql`INSERT INTO "OuiTank-players" (id, username, email, type, password_hash, google_id, creation_timestamp) 
      SELECT id, username, email, type, password_hash, google_id, creation_timestamp FROM players 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-players_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-players") + 1)`
    );

    console.log("2. Migrating player_sessions...");
    await db.execute(sql`INSERT INTO "OuiTank-player_sessions" (id, player_id, session_token, expiration_timestamp) 
      SELECT id, player_id, session_token, expiration_timestamp FROM player_sessions 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-player_sessions_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-player_sessions") + 1)`
    );

    console.log("3. Migrating levels...");
    await db.execute(sql`INSERT INTO "OuiTank-levels" (id, name, creator_id, max_players, type, status, content, creation_timestamp) 
      SELECT id, name, creator_id, max_players, type, status, content, creation_timestamp FROM levels 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-levels_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-levels") + 1)`
    );

    console.log("4. Migrating levels_img...");
    await db.execute(sql`INSERT INTO "OuiTank-levels_img" (id, level_id, img) 
      SELECT id, level_id, img FROM levels_img 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-levels_img_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-levels_img") + 1)`
    );

    console.log("5. Migrating campaigns...");
    await db.execute(sql`INSERT INTO "OuiTank-campaigns" (id, name, creator_id, description, creation_timestamp) 
      SELECT id, name, creator_id, description, creation_timestamp FROM campaigns 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-campaigns_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-campaigns") + 1)`
    );

    console.log("6. Migrating campaign_levels...");
    await db.execute(sql`INSERT INTO "OuiTank-campaign_levels" (id, campaign_id, level_id, order_index) 
      SELECT id, campaign_id, level_id, order_index FROM campaign_levels 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-campaign_levels_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-campaign_levels") + 1)`
    );

    console.log("7. Migrating ratings...");
    await db.execute(sql`INSERT INTO "OuiTank-ratings" (id, stars, level_id, player_id) 
      SELECT id, stars, level_id, player_id FROM ratings 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-ratings_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-ratings") + 1)`
    );

    console.log("8. Migrating logings...");
    await db.execute(sql`INSERT INTO "OuiTank-logings" (id, player_id, ip_address, attempt_timestamp, status) 
      SELECT id, player_id, ip_address, attempt_timestamp, status FROM logings 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-logings_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-logings") + 1)`
    );

    console.log("9. Migrating rounds...");
    await db.execute(sql`INSERT INTO "OuiTank-rounds" (id, player_id, level_id, wins, kills, deaths, shots, hits, plants, blocks_destroyed, timestamp) 
      SELECT id, player_id, level_id, wins, kills, deaths, shots, hits, plants, blocks_destroyed, timestamp FROM rounds 
      ON CONFLICT DO NOTHING`);
    await db.execute(
      sql`SELECT setval('"OuiTank-rounds_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "OuiTank-rounds") + 1)`
    );

    console.log("");
    console.log("═══════════════════════════════════════════");
    console.log("  ✓ Data migration complete!");
    console.log("═══════════════════════════════════════════");
    process.exit(0);
  } catch (err) {
    console.error("");
    console.error(
      "✗ Migration error:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

migrateData();
