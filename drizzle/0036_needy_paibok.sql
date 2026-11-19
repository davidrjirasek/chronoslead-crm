CREATE TABLE "consulta_externa" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"criterio" text,
	"dato_pedido" text NOT NULL,
	"url" text NOT NULL,
	"method" text DEFAULT 'POST' NOT NULL,
	"request_field" text NOT NULL,
	"response_field" text NOT NULL,
	"auth_header" text,
	"auth_value_enc" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consulta_externa" ADD CONSTRAINT "consulta_externa_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consulta_externa_org_uq" ON "consulta_externa" USING btree ("organization_id");