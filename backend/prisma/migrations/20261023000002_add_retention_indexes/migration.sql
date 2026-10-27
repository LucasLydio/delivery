DROP INDEX "push_subscriptions_customer_id_idx";

CREATE INDEX "push_subscriptions_customer_id_updated_at_idx"
ON "push_subscriptions"("customer_id", "updated_at");

CREATE INDEX "customer_sessions_revoked_at_idx"
ON "customer_sessions"("revoked_at");

CREATE INDEX "user_sessions_revoked_at_idx"
ON "user_sessions"("revoked_at");

CREATE INDEX "order_events_created_at_idx"
ON "order_events"("created_at");
