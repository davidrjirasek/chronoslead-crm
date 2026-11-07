ALTER TABLE "meta_credentials" ALTER COLUMN "waba_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ALTER COLUMN "phone_number_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "source" text DEFAULT 'meta' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "account_ref" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "webhook_secret_cipher" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "webhook_secret_iv" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "webhook_secret_tag" text;--> statement-breakpoint
CREATE UNIQUE INDEX "meta_credentials_account_ref_uq" ON "meta_credentials" USING btree ("account_ref");