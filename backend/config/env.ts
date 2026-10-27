import { z } from "zod";

const emptyAsUndefined = (value: unknown) => value === "" ? undefined : value;
const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());

const runtimeSchema = z.object({
  DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  CACHE_NAMESPACE: z.string().regex(/^[a-zA-Z0-9:_-]+$/).default("delivery"),
  CATALOG_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default("BRL"),
  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  PRODUCT_IMAGE_BASE_URL: z.string().min(1).default("/images/products/"),
  LOCAL_PRODUCT_IMAGE_DIRECTORY: z.string().min(1).default("public/images/products"),
  SUPABASE_URL: optionalUrl,
  SUPABASE_STORAGE_BUCKET: z.preprocess(emptyAsUndefined, z.string().regex(/^[A-Za-z0-9_-]{1,63}$/).optional()),
  CORS_ORIGIN: z.string().optional(),
  VAPID_PUBLIC_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  VAPID_PRIVATE_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  VAPID_SUBJECT: z.preprocess(emptyAsUndefined, z.string().refine(
    (value) => value.startsWith("mailto:") || value.startsWith("https://"),
    "VAPID_SUBJECT must use mailto: or https://",
  ).optional()),
  AUTH_TOKEN_SECRET: z.preprocess(emptyAsUndefined, z.string().min(32).optional()),
  AUTH_TOKEN_ISSUER: z.string().min(1).default("delivery-api"),
  AUTH_TOKEN_AUDIENCE: z.string().min(1).default("delivery-pwa"),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_REFRESH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("delivery_refresh"),
  ADMIN_AUTH_TOKEN_SECRET: z.preprocess(emptyAsUndefined, z.string().min(32).optional()),
  ADMIN_AUTH_TOKEN_AUDIENCE: z.string().min(1).default("delivery-admin"),
  ADMIN_AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  ADMIN_AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  ADMIN_AUTH_REFRESH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("delivery_admin_refresh"),
  CART_DELIVERY_FEE_MINOR: z.coerce.number().int().min(0).max(10_000_000).default(0),
  CART_QUOTE_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  LIMIT_KM: z.string().regex(/^\d+(?:\.\d{1,3})?$/).default("0"),
  FEE_PER_KM: z.string().regex(/^\d+(?:\.\d{1,2})?$/).default("0.00"),
  MERCADO_PAGO_FEE_PERCENT: z.string().regex(/^\d+(?:\.\d{1,4})?$/).default("0"),
  SHOP_LATITUDE: z.preprocess(emptyAsUndefined, z.coerce.number().min(-90).max(90).optional()),
  SHOP_LONGITUDE: z.preprocess(emptyAsUndefined, z.coerce.number().min(-180).max(180).optional()),
  MERCADO_PAGO_ACCESS_TOKEN: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  MERCADO_PAGO_PUBLIC_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  MERCADO_PAGO_WEBHOOK_SECRET: z.preprocess(emptyAsUndefined, z.string().min(16).optional()),
  MERCADO_PAGO_API_URL: z.url().default("https://api.mercadopago.com"),
  CHECKOUT_LOCK_TTL_MS: z.coerce.number().int().min(5_000).max(60_000).default(15_000),
  UNPAID_ORDER_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  ORDER_EVENT_RETENTION_DAYS: z.coerce.number().int().min(7).max(730).default(90),
  STATE_SNAPSHOT_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  ORPHAN_PUSH_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  MAX_ADDRESSES_PER_CUSTOMER: z.coerce.number().int().min(1).max(50).default(10),
  MAX_PUSH_SUBSCRIPTIONS_PER_CUSTOMER: z.coerce.number().int().min(1).max(20).default(5),
});

export function getRuntimeConfig() {
  const parsed = runtimeSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      key: issue.path.join("."),
      message: issue.message,
    }));
    console.error("Invalid backend environment variables", issues);
    const summary = issues.map((issue) => `${issue.key}: ${issue.message}`).join("; ");
    throw new Error(`Invalid backend environment configuration (${summary})`);
  }
  return parsed.data;
}

export function getDatabaseUrl(): string {
  const databaseUrl = getRuntimeConfig().DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this endpoint");
  const url = new URL(databaseUrl);
  if (process.env["NODE_ENV"] === "production" && url.hostname.endsWith(".supabase.com")) {
    const transactionPooler = url.hostname.includes(".pooler.supabase.com") && url.port === "6543";
    if (!transactionPooler) {
      throw new Error("Production DATABASE_URL must use the Supabase transaction pooler on port 6543");
    }
  }
  return databaseUrl;
}

export function getAllowedOrigins(): Set<string> {
  const configured = getRuntimeConfig().CORS_ORIGIN;
  return new Set((configured ?? "http://localhost:4200").split(",").map((value) => value.trim()).filter(Boolean));
}
