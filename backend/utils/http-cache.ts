import type { Request } from "express";

export const revalidateHeaders = { "cache-control": "public, max-age=0, must-revalidate" } as const;

export function matchesEtag(request: Request, etag: string): boolean {
  return request.headers["if-none-match"]?.split(",").some((tag) => tag.trim() === etag) ?? false;
}

