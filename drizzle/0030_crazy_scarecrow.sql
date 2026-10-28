ALTER TABLE "cuestionario_respuesta" ADD COLUMN "variante" text DEFAULT 'general' NOT NULL;
--> statement-breakpoint
-- 130 — Los cuestionarios que YA existen son de The Student Store: su enlace
-- está en manos del cliente y puede estar completándolo ahora mismo. El valor
-- por defecto de la columna es «general» para los que vengan, pero a los que
-- ya están hay que dejarlos con SUS preguntas, o se les moverían debajo.
UPDATE "cuestionario_respuesta" SET "variante" = 'the-student-store';
