ALTER TABLE "organization" ADD COLUMN "paid_through" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "suspended_reason" text;