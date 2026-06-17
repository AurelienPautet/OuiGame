CREATE TABLE "OuiTank-password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"token_hash" varchar(120) NOT NULL,
	"expiration_timestamp" timestamp DEFAULT NOW() + INTERVAL '1 hour',
	CONSTRAINT "OuiTank-password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "OuiTank-password_reset_tokens" ADD CONSTRAINT "OuiTank-password_reset_tokens_player_id_OuiTank-players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE cascade ON UPDATE no action;