import type { Request } from 'express';

export const publicCatalogHeaders = {
  'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
  'netlify-cdn-cache-control': 'public, durable, s-maxage=300, stale-while-revalidate=86400',
} as const;

export function matchesEtag(request: Request, etag: string): boolean {
  return request.headers['if-none-match']?.split(',').some((tag) => tag.trim() === etag) ?? false;
}
