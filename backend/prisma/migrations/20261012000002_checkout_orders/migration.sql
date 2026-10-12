ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "PaymentMethod" AS ENUM ('MERCADO_PAGO_PIX', 'MERCADO_PAGO_CARD', 'PAY_ON_DELIVERY', 'PAY_AT_STORE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'ON_DELIVERY', 'AT_STORE', 'FAILED', 'CANCELLED');

ALTER TABLE "orders"
    ADD COLUMN "payment_method" "PaymentMethod",
    ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "cart_revision" INTEGER,
    ADD COLUMN "payment_fee_minor" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "discount_percent" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "discount_minor" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "coupon_code" TEXT,
    ADD COLUMN "distance_meters" INTEGER,
    ADD COLUMN "mercado_pago_order_id" TEXT,
    ADD COLUMN "mercado_pago_status" TEXT,
    ADD COLUMN "payment_data" JSONB,
    ADD COLUMN "payment_expires_at" TIMESTAMP(3),
    ADD COLUMN "confirmed_at" TIMESTAMP(3),
    ADD COLUMN "cancelled_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_mercado_pago_order_id_key" ON "orders"("mercado_pago_order_id");
CREATE INDEX "orders_status_payment_expires_at_idx" ON "orders"("status", "payment_expires_at");

CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_active_starts_at_expires_at_idx" ON "coupons"("active", "starts_at", "expires_at");

CREATE TABLE "delivery_pricing_settings" (
    "id" TEXT NOT NULL,
    "limit_km" DECIMAL(8,3) NOT NULL,
    "fee_per_km_minor" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_pricing_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_events" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_customer_id_id_idx" ON "order_events"("customer_id", "id");
CREATE INDEX "order_events_order_id_id_idx" ON "order_events"("order_id", "id");
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_amounts_nonnegative" CHECK (
    "payment_fee_minor" >= 0 AND "discount_minor" >= 0 AND "discount_percent" BETWEEN 0 AND 100
    AND ("distance_meters" IS NULL OR "distance_meters" >= 0)
);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_supported_discount" CHECK ("discount_percent" IN (5, 10, 15, 20, 25, 30, 50));
ALTER TABLE "delivery_pricing_settings" ADD CONSTRAINT "delivery_pricing_settings_valid" CHECK (
    "id" = 'main' AND "limit_km" >= 0 AND "fee_per_km_minor" >= 0
);
