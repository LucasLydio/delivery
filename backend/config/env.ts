import { z } from "zod";

const optionalUrl = z.string().url().optional();

const runtimeSchema = z.object({
  DATABASE_URL: optionalUrl,
  CORS_ORIGIN: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
});

export function getRuntimeConfig() {
  const parsed = runtimeSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid backend environment configuration");
  }
  return parsed.data;
}

export function getDatabaseUrl(): string {
  const databaseUrl = getRuntimeConfig().DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this endpoint");
  return databaseUrl;
}

export function getAllowedOrigins(): Set<string> {
  const configured = getRuntimeConfig().CORS_ORIGIN;
  return new Set((configured ?? "http://localhost:4200").split(",").map((value) => value.trim()).filter(Boolean));
}
