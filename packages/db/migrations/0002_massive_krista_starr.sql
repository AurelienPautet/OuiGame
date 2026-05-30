CREATE TABLE "OuiTank-campaign_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"campaign_id" integer NOT NULL,
	"levels_cleared" integer NOT NULL,
	"lives_left" integer NOT NULL,
	"completed" boolean NOT NULL,
	"time_ms" integer NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" ADD CONSTRAINT "OuiTank-campaign_runs_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" ADD CONSTRAINT "OuiTank-campaign_runs_campaign_id_OuiTank-campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."OuiTank-campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "levels_creator_id_idx" ON "OuiTank-levels" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "levels_img_level_id_idx" ON "OuiTank-levels_img" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "rounds_level_id_idx" ON "OuiTank-rounds" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "rounds_player_id_idx" ON "OuiTank-rounds" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "solo_rounds_level_id_idx" ON "OuiTank-solo_rounds" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "solo_rounds_player_id_idx" ON "OuiTank-solo_rounds" USING btree ("player_id");