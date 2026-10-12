import { BadRequestException } from "../shared/exceptions";

export interface SearchCriteria {
  query?: string;
}

export function normalizeSearch(value: unknown, maximumLength = 80): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new BadRequestException("Search query must be text");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (normalized.length > maximumLength) throw new BadRequestException(`Search query must have at most ${maximumLength} characters`);
  return normalized;
}

export function searchCacheSegment(criteria: SearchCriteria): string {
  return criteria.query ? `q:${encodeURIComponent(criteria.query.toLocaleLowerCase("pt-BR"))}` : "all";
}
