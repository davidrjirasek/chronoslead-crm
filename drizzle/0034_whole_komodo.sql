-- 146 · Agenda por recurso. ADITIVA: ninguna columna se pierde y ninguna fila
-- cambia de valor. `resource_id` nace NULL en todo lo que ya existe, que es
-- exactamente "la agenda única de siempre".
--
-- El único paso que no es un ADD es el índice anti doble-booking: se reemplaza
-- por el mismo índice con `coalesce(resource_id,'')` adentro. Con todo en NULL
-- el coalesce devuelve '' y el índice resultante es equivalente al anterior.
-- Van juntos y en este orden a propósito: la migración corre en una
-- transacción, así que no hay instante visible sin protección.

CREATE TABLE "agenda_resource" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"weekly_hours" jsonb,
	"color" text,
	"criterio" text,
	"avisos" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "booking_org_active_slot_uq";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "offered_slot" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "agenda_resources" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_resource" ADD CONSTRAINT "agenda_resource_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_resource_org_pos_idx" ON "agenda_resource" USING btree ("organization_id","position");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_resource_id_agenda_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."agenda_resource"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offered_slot" ADD CONSTRAINT "offered_slot_resource_id_agenda_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."agenda_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_org_resource_when_idx" ON "booking" USING btree ("organization_id","resource_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_org_resource_active_slot_uq" ON "booking" USING btree ("organization_id",coalesce("resource_id", ''),"scheduled_at") WHERE "booking"."status" in ('agendada','realizada') and "booking"."is_test" = false;