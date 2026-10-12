import type { CatalogProduct, CatalogSnapshot } from "../../../shared/commerce-contract";
import type { ProductRow, ProductsRepository } from "./products.repository";
import { searchCacheSegment, type SearchCriteria } from "../../utils/search";

export interface CatalogCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export function productImageUrl(baseUrl: string, storageKey: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}

export function toCatalogProduct(row: ProductRow, imageBaseUrl: string): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    basePriceMinor: row.basePriceMinor,
    currency: row.currency,
    available: row.available,
    images: row.images.map((image) => ({
      key: image.storageKey,
      url: productImageUrl(imageBaseUrl, image.storageKey),
      alt: image.alt,
      width: image.width,
      height: image.height,
    })),
    optionGroups: row.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaMinor: option.priceDeltaMinor,
        available: option.available,
      })),
    })),
  };
}

export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly cache: CatalogCache,
    private readonly currency: string,
    private readonly imageBaseUrl: string,
    private readonly namespace: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  version(): Promise<number> { return this.repository.version(); }

  async list(version: number, criteria: SearchCriteria = {}): Promise<CatalogSnapshot> {
    const key = `${this.namespace}:catalog:v${version}:products:${searchCacheSegment(criteria)}`;
    const cached = await this.cache.get(key);
    if (cached) {
      try { return JSON.parse(cached) as CatalogSnapshot; }
      catch { /* A damaged cache entry is treated as a miss. */ }
    }

    const rows = await this.repository.list(criteria);
    if (rows.some((row) => row.currency !== this.currency)) throw new Error("Catalog currency does not match brand currency");
    const snapshot: CatalogSnapshot = {
      version: String(version),
      fetchedAt: this.now().toISOString(),
      currency: this.currency,
      products: rows.map((row) => toCatalogProduct(row, this.imageBaseUrl)),
    };
    await this.cache.set(key, JSON.stringify(snapshot), 300);
    return snapshot;
  }

  async findById(id: string, version: number): Promise<CatalogProduct | null> {
    const key = `${this.namespace}:catalog:v${version}:product:${id}`;
    const cached = await this.cache.get(key);
    if (cached) {
      try { return JSON.parse(cached) as CatalogProduct; }
      catch { /* A damaged cache entry is treated as a miss. */ }
    }

    const row = await this.repository.findById(id);
    if (!row) return null;
    if (row.currency !== this.currency) throw new Error("Catalog currency does not match brand currency");
    const product = toCatalogProduct(row, this.imageBaseUrl);
    await this.cache.set(key, JSON.stringify(product), 300);
    return product;
  }
}
