-- ============================================
-- STEP 1: BACKUP - Create copies of all existing tables (if they exist)
-- ============================================

CREATE TABLE IF NOT EXISTS "backup_players" AS SELECT * FROM players;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_player_sessions" AS SELECT * FROM player_sessions;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_levels" AS SELECT * FROM levels;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_levels_img" AS SELECT * FROM levels_img;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_campaigns" AS SELECT * FROM campaigns;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_campaign_levels" AS SELECT * FROM campaign_levels;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_ratings" AS SELECT * FROM ratings;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_logings" AS SELECT * FROM logings;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_rounds" AS SELECT * FROM rounds;
--> statement-breakpoint

-- ============================================
-- STEP 2: CREATE NEW TABLES with OuiTank- prefix
-- ============================================

CREATE TABLE "OuiTank-campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(30) NOT NULL,
	"creator_id" integer NOT NULL,
	"description" varchar(300) NOT NULL,
	"creation_timestamp" timestamp DEFAULT now(),
	CONSTRAINT "OuiTank-campaigns_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "OuiTank-campaign_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"level_id" integer NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OuiTank-players" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(30) NOT NULL,
	"email" varchar(60) NOT NULL,
	"type" varchar(10) NOT NULL,
	"password_hash" varchar(250),
	"google_id" varchar(500),
	"creation_timestamp" timestamp DEFAULT now(),
	CONSTRAINT "OuiTank-players_username_unique" UNIQUE("username"),
	CONSTRAINT "OuiTank-players_email_unique" UNIQUE("email"),
	CONSTRAINT "correct_auth" CHECK (
    ("OuiTank-players"."type" = 'google' AND "OuiTank-players"."google_id" IS NOT NULL) OR
    ("OuiTank-players"."type" = 'db' AND "OuiTank-players"."password_hash" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "OuiTank-player_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"session_token" varchar(120) NOT NULL,
	"expiration_timestamp" timestamp DEFAULT NOW() + INTERVAL '7 days',
	CONSTRAINT "OuiTank-player_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "OuiTank-levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(30) NOT NULL,
	"creator_id" integer NOT NULL,
	"max_players" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(30) NOT NULL,
	"content" json NOT NULL,
	"creation_timestamp" timestamp DEFAULT now(),
	CONSTRAINT "OuiTank-levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "OuiTank-levels_img" (
	"id" serial PRIMARY KEY NOT NULL,
	"level_id" integer NOT NULL,
	"img" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OuiTank-ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"stars" integer NOT NULL,
	"level_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "OuiTank-ratings_level_id_player_id_unique" UNIQUE("level_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "OuiTank-logings" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"ip_address" varchar NOT NULL,
	"attempt_timestamp" timestamp DEFAULT now(),
	"status" varchar(30) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OuiTank-rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"level_id" integer NOT NULL,
	"wins" integer NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"shots" integer NOT NULL,
	"hits" integer NOT NULL,
	"plants" integer NOT NULL,
	"blocks_destroyed" integer NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "OuiTank-campaigns" ADD CONSTRAINT "OuiTank-campaigns_creator_id_OuiTank-players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" ADD CONSTRAINT "OuiTank-campaign_levels_campaign_id_OuiTank-campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."OuiTank-campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" ADD CONSTRAINT "OuiTank-campaign_levels_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-player_sessions" ADD CONSTRAINT "OuiTank-player_sessions_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-levels" ADD CONSTRAINT "OuiTank-levels_creator_id_OuiTank-players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-levels_img" ADD CONSTRAINT "OuiTank-levels_img_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" ADD CONSTRAINT "OuiTank-ratings_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" ADD CONSTRAINT "OuiTank-ratings_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-logings" ADD CONSTRAINT "OuiTank-logings_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" ADD CONSTRAINT "OuiTank-rounds_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" ADD CONSTRAINT "OuiTank-rounds_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE no action ON UPDATE no action;