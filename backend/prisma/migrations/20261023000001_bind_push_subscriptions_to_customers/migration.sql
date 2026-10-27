ALTER TABLE "push_subscriptions"
ADD COLUMN "customer_id" TEXT;

CREATE INDEX "push_subscriptions_customer_id_idx"
ON "push_subscriptions"("customer_id");

ALTER TABLE "push_subscriptions"
ADD CONSTRAINT "push_subscriptions_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
