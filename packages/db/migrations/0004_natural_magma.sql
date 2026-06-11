CREATE TABLE "OuiTank-player_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"achievement_key" varchar(50) NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	CONSTRAINT "OuiTank-player_achievements_player_id_achievement_key_unique" UNIQUE("player_id","achievement_key")
);
--> statement-breakpoint
ALTER TABLE "OuiTank-player_achievements" ADD CONSTRAINT "OuiTank-player_achievements_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_achievements_player_id_idx" ON "OuiTank-player_achievements" USING btree ("player_id");