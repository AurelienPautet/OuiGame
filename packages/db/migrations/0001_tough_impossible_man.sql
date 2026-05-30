CREATE TABLE "OuiTank-solo_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"level_id" integer NOT NULL,
	"success" boolean NOT NULL,
	"time_ms" integer NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"shots" integer NOT NULL,
	"hits" integer NOT NULL,
	"plants" integer NOT NULL,
	"blocks_destroyed" integer NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" ADD CONSTRAINT "OuiTank-solo_rounds_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" ADD CONSTRAINT "OuiTank-solo_rounds_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE no action ON UPDATE no action;