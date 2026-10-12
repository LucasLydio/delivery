import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { getAllowedOrigins } from "../config/env";
import { ForbiddenException } from "./exceptions";
import { apiResponse } from "./response";

export const requestContext: RequestHandler = (request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  response.set("x-request-id", requestId);
  response.set("cache-control", "no-store");
  next();
};

export const cors: RequestHandler = (request, response, next) => {
  const origin = request.header("origin");
  const requestOrigin = `${request.protocol}://${request.get("host")}`;
  response.vary("Origin");
  if (origin && origin !== requestOrigin && !getAllowedOrigins().has(origin)) {
    next(new ForbiddenException());
    return;
  }

  if (origin) response.set("access-control-allow-origin", origin);
  response.set("access-control-allow-methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.set("access-control-allow-headers", "authorization, content-type, x-request-id, x-idempotency-key, last-event-id");
  response.set("access-control-allow-credentials", "true");
  if (request.method === "OPTIONS") {
    apiResponse.options(response);
    return;
  }
  next();
};
