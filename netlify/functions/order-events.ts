import { Readable, PassThrough } from "node:stream";
import { stream, type StreamingResponse } from "@netlify/functions";
import { getRuntimeConfig } from "../../backend/config/env";
import { PrismaOrdersRepository } from "../../backend/modules/orders/orders.repository";
import { CustomerTokenService } from "../../backend/modules/customers/customers.tokens";

function response(statusCode: number, body: string, contentType = "application/json"): StreamingResponse {
  return { statusCode, headers: { "content-type": contentType, "cache-control": "no-store" }, body: Readable.from([body]) };
}

export const handler = stream(async (event) => {
  const authorization = event.headers.authorization;
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) return response(401, JSON.stringify({ error: "Bearer access token required" }));
  const config = getRuntimeConfig();
  const tokens = new CustomerTokenService(
    config.AUTH_TOKEN_SECRET, config.AUTH_TOKEN_ISSUER, config.AUTH_TOKEN_AUDIENCE, config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  );
  let customerId: string;
  try {
    customerId = await tokens.verifyAccessToken(token);
  } catch {
    return response(401, JSON.stringify({ error: "Invalid or expired access token" }));
  }
  const rawCursor = event.headers["last-event-id"] ?? event.queryStringParameters?.after ?? "0";
  if (!/^\d+$/.test(rawCursor)) return response(400, JSON.stringify({ error: "Invalid event cursor" }));

  const output = new PassThrough();
  const repository = new PrismaOrdersRepository();
  void (async () => {
    let cursor = BigInt(rawCursor);
    const finishAt = Date.now() + 50_000;
    output.write(": connected\n\n");
    try {
      while (Date.now() < finishAt && !output.destroyed) {
        const events = await repository.events(customerId, cursor, 100);
        for (const notification of events) {
          cursor = BigInt(notification.id);
          output.write(`id: ${notification.id}\nevent: ${notification.type}\ndata: ${JSON.stringify(notification)}\n\n`);
        }
        output.write(": keepalive\n\n");
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    } catch {
      if (!output.destroyed) output.write("event: stream.error\ndata: {\"retry\":true}\n\n");
    } finally {
      output.end();
    }
  })();
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
    body: output,
  };
});

