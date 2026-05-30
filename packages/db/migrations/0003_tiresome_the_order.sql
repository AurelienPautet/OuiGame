ALTER TABLE "OuiTank-campaigns" DROP CONSTRAINT "OuiTank-campaigns_creator_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" DROP CONSTRAINT "OuiTank-campaign_levels_campaign_id_OuiTank-campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" DROP CONSTRAINT "OuiTank-campaign_levels_level_id_OuiTank-levels_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" DROP CONSTRAINT "OuiTank-campaign_runs_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" DROP CONSTRAINT "OuiTank-campaign_runs_campaign_id_OuiTank-campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-player_sessions" DROP CONSTRAINT "OuiTank-player_sessions_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-levels" DROP CONSTRAINT "OuiTank-levels_creator_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-levels_img" DROP CONSTRAINT "OuiTank-levels_img_level_id_OuiTank-levels_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" DROP CONSTRAINT "OuiTank-ratings_level_id_OuiTank-levels_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" DROP CONSTRAINT "OuiTank-ratings_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-logings" DROP CONSTRAINT "OuiTank-logings_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" DROP CONSTRAINT "OuiTank-rounds_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" DROP CONSTRAINT "OuiTank-rounds_level_id_OuiTank-levels_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" DROP CONSTRAINT "OuiTank-solo_rounds_player_id_OuiTank-players_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" DROP CONSTRAINT "OuiTank-solo_rounds_level_id_OuiTank-levels_id_fk";
--> statement-breakpoint
ALTER TABLE "OuiTank-campaigns" ADD CONSTRAINT "OuiTank-campaigns_creator_id_OuiTank-players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" ADD CONSTRAINT "OuiTank-campaign_levels_campaign_id_OuiTank-campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."OuiTank-campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_levels" ADD CONSTRAINT "OuiTank-campaign_levels_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" ADD CONSTRAINT "OuiTank-campaign_runs_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-campaign_runs" ADD CONSTRAINT "OuiTank-campaign_runs_campaign_id_OuiTank-campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."OuiTank-campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-player_sessions" ADD CONSTRAINT "OuiTank-player_sessions_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-levels" ADD CONSTRAINT "OuiTank-levels_creator_id_OuiTank-players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-levels_img" ADD CONSTRAINT "OuiTank-levels_img_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" ADD CONSTRAINT "OuiTank-ratings_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-ratings" ADD CONSTRAINT "OuiTank-ratings_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-logings" ADD CONSTRAINT "OuiTank-logings_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" ADD CONSTRAINT "OuiTank-rounds_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-rounds" ADD CONSTRAINT "OuiTank-rounds_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" ADD CONSTRAINT "OuiTank-solo_rounds_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OuiTank-solo_rounds" ADD CONSTRAINT "OuiTank-solo_rounds_level_id_OuiTank-levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."OuiTank-levels"("id") ON DELETE cascade ON UPDATE no action;