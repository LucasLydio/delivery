import { ZodError } from "zod";
import { getAllowedOrigins, getRuntimeConfig } from "./config/env";
import { getPrisma } from "./infra/prisma/client";
import { deletePushSchema, registerPushSchema } from "./modules/push/push.schema";
import { registerSubscription, unregisterSubscription } from "./modules/push/push.service";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({ vary: "Origin" });
  const origin = request.headers.get("origin");
  if (origin && (origin === new URL(request.url).origin || getAllowedOrigins().has(origin))) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
  }
  return headers;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function handleApi(request: Request): Promise<Response> {
  const headers = corsHeaders(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && !getAllowedOrigins().has(origin)) return json({ error: "Origin not allowed" }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const requestPath = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    // Netlify's public route may retain /api while local direct function calls may not.
    const functionPath = requestPath.startsWith("/.netlify/functions/api/")
      ? requestPath.slice("/.netlify/functions/api".length)
      : requestPath;
    const path = functionPath === "/api" ? "/" : functionPath.startsWith("/api/") ? functionPath.slice(4) : functionPath;

    if (request.method === "GET" && path === "/health") {
      return json({ status: "ok" }, 200, headers);
    }

    if (request.method === "GET" && path === "/state/latest") {
      // The UI can boot before a local database or production connection is configured.
      // Once configured, failures are still surfaced rather than hidden as empty state.
      if (!getRuntimeConfig().DATABASE_URL) {
        return json({ state: null, updatedAt: null }, 200, headers);
      }
      const latest = await getPrisma().stateSnapshot.findFirst({
        orderBy: { createdAt: "desc" },
        select: { state: true, createdAt: true },
      });
      return json({ state: latest?.state ?? null, updatedAt: latest?.createdAt.toISOString() ?? null }, 200, headers);
    }

    if (request.method === "GET" && path === "/config/push-key") {
      const publicKey = getRuntimeConfig().VAPID_PUBLIC_KEY;
      if (!publicKey) return json({ enabled: false, publicKey: null }, 200, headers);
      return json({ enabled: true, publicKey }, 200, headers);
    }

    if (request.method === "POST" && path === "/push/subscriptions") {
      const input = registerPushSchema.parse(await readJson(request));
      await registerSubscription(input);
      return json({ registered: true }, 201, headers);
    }

    if (request.method === "DELETE" && path === "/push/subscriptions") {
      const input = deletePushSchema.parse(await readJson(request));
      const removed = await unregisterSubscription(input);
      return json({ removed }, 200, headers);
    }

    return json({ error: "Not found" }, 404, headers);
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: "Invalid request", details: error.issues.map(({ path, message }) => ({ path, message })) }, 400, headers);
    }
    if (error instanceof HttpError) return json({ error: error.message }, error.status, headers);
    if (error instanceof Error && error.message.includes("DATABASE_URL is required")) {
      return json({ error: "Service unavailable", detail: "Database is not configured" }, 503, headers);
    }
    console.error("API request failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Internal server error" }, 500, headers);
  }
}
