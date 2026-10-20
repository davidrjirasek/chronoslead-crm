CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cobrado_en" timestamp NOT NULL,
	"cubre_desde" timestamp NOT NULL,
	"cubre_hasta" timestamp NOT NULL,
	"importe_centavos" integer NOT NULL,
	"moneda" text NOT NULL,
	"nota" text,
	"registrado_por" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_org_cobrado_idx" ON "payment" USING btree ("organization_id","cobrado_en");