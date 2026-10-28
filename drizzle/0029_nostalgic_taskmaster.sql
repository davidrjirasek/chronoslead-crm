CREATE TABLE "cuestionario_respuesta" (
	"id" text PRIMARY KEY NOT NULL,
	"llave" text NOT NULL,
	"cliente" text NOT NULL,
	"contacto" text,
	"correo" text,
	"seccion_actual" integer DEFAULT 0 NOT NULL,
	"respuestas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enviado_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cuestionario_respuesta_llave_idx" ON "cuestionario_respuesta" USING btree ("llave");--> statement-breakpoint
CREATE INDEX "cuestionario_respuesta_cliente_idx" ON "cuestionario_respuesta" USING btree ("cliente","created_at");