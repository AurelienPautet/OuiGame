CREATE TABLE "OuiTank-daily_active_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"visitor_key" varchar(80) NOT NULL,
	"player_id" integer,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "OuiTank-daily_active_users_day_visitor_key_unique" UNIQUE("day","visitor_key")
);
--> statement-breakpoint
ALTER TABLE "OuiTank-daily_active_users" ADD CONSTRAINT "OuiTank-daily_active_users_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_active_users_day_idx" ON "OuiTank-daily_active_users" USING btree ("day");--> statement-breakpoint
CREATE INDEX "daily_active_users_player_id_idx" ON "OuiTank-daily_active_users" USING btree ("player_id");