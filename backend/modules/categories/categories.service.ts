import type { CatalogCategory, CategorySnapshot } from "../../../shared/commerce-contract";
import type { CategoriesRepository, CategoryRow } from "./categories.repository";

export interface CategoryCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export function toCatalogCategory(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sortOrder,
    availableProductCount: row._count.products,
  };
}

export class CategoriesService {
  constructor(
    private readonly repository: CategoriesRepository,
    private readonly cache: CategoryCache,
    private readonly namespace: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  version(): Promise<number> { return this.repository.version(); }

  async list(version: number): Promise<CategorySnapshot> {
    const key = `${this.namespace}:catalog:v${version}:categories`;
    const cached = await this.cache.get(key);
    if (cached) {
      try { return JSON.parse(cached) as CategorySnapshot; }
      catch { /* Treat damaged cache data as a miss. */ }
    }
    const snapshot: CategorySnapshot = {
      version: String(version),
      fetchedAt: this.now().toISOString(),
      categories: (await this.repository.list()).map(toCatalogCategory),
    };
    await this.cache.set(key, JSON.stringify(snapshot), 300);
    return snapshot;
  }

  async findById(id: string, version: number): Promise<CatalogCategory | null> {
    const key = `${this.namespace}:catalog:v${version}:category:${id}`;
    const cached = await this.cache.get(key);
    if (cached) {
      try { return JSON.parse(cached) as CatalogCategory; }
      catch { /* Treat damaged cache data as a miss. */ }
    }
    const row = await this.repository.findById(id);
    if (!row) return null;
    const category = toCatalogCategory(row);
    await this.cache.set(key, JSON.stringify(category), 300);
    return category;
  }
}

