CREATE TABLE "team_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"actor_etiqueta" text NOT NULL,
	"accion" text NOT NULL,
	"objetivo_id" text,
	"objetivo_etiqueta" text NOT NULL,
	"detalle" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_audit" ADD CONSTRAINT "team_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_audit" ADD CONSTRAINT "team_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_audit" ADD CONSTRAINT "team_audit_objetivo_id_user_id_fk" FOREIGN KEY ("objetivo_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_audit_org_fecha_idx" ON "team_audit" USING btree ("organization_id","created_at");