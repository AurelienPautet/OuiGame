CREATE TABLE "OuiTank-admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" varchar(60) NOT NULL,
	"target_type" varchar(30),
	"target_id" integer,
	"details" json,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "OuiTank-players" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "OuiTank-admin_audit_log" ADD CONSTRAINT "OuiTank-admin_audit_log_actor_id_OuiTank-players_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."OuiTank-players"("id") ON DELETE set null ON UPDATE no action;