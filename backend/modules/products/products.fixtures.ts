import type { ProductRow, ProductsRepository } from "./products.repository";
import type { CatalogCache } from "./products.service";
import type { SearchCriteria } from "../../utils/search";

export function productFixture(): ProductRow {
  return {
    id: "product-1", slug: "poke", name: "Poke", description: "Fresco",
    categoryId: "category-1", category: { id: "category-1", name: "Pratos" },
    basePriceMinor: 2590, currency: "BRL", available: true,
    images: [{ storageKey: "menu/poke 1.webp", alt: "Poke", width: 640, height: 640 }],
    optionGroups: [{
      id: "group-1", name: "Extras", minSelections: 0, maxSelections: 2,
      options: [{ id: "option-1", name: "Abacate", priceDeltaMinor: 350, available: true }],
    }],
  } as ProductRow;
}

export class MemoryCache implements CatalogCache {
  readonly values = new Map<string, string>();
  readonly ttl = new Map<string, number>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async set(key: string, value: string, ttlSeconds: number) {
    this.values.set(key, value);
    this.ttl.set(key, ttlSeconds);
  }
}

export class MemoryProductsRepository implements ProductsRepository {
  revision = 1;
  rows = [productFixture()];
  listCalls = 0;
  detailCalls = 0;
  lastCriteria: SearchCriteria | undefined;
  async version() { return this.revision; }
  async list(criteria?: SearchCriteria) { this.listCalls++; this.lastCriteria = criteria; return this.rows; }
  async findById(id: string) { this.detailCalls++; return this.rows.find((row) => row.id === id) ?? null; }
}
