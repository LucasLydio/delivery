-- Existing customers keep a nullable login name and are upgraded on first login.
ALTER TABLE "customers" ADD COLUMN "login_name" TEXT;

-- A phone number identifies one customer account.
UPDATE "customers"
SET "phone" = CASE
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 11
        THEN '+55' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 13
         AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE '55%'
        THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
    ELSE "phone"
END
WHERE "phone" IS NOT NULL;

CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_sessions_token_hash_key" ON "customer_sessions"("token_hash");
CREATE INDEX "customer_sessions_customer_id_created_at_idx" ON "customer_sessions"("customer_id", "created_at");
CREATE INDEX "customer_sessions_family_id_idx" ON "customer_sessions"("family_id");
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

ALTER TABLE "customer_sessions"
ADD CONSTRAINT "customer_sessions_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
