import type { CategoriesRepository, CategoryRow } from "./categories.repository";
import type { CategoryCache } from "./categories.service";

export class MemoryCategoryCache implements CategoryCache {
  readonly values = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async set(key: string, value: string): Promise<void> { this.values.set(key, value); }
}

export class MemoryCategoriesRepository implements CategoriesRepository {
  revision = 1;
  listCalls = 0;
  detailCalls = 0;
  rows: CategoryRow[] = [
    { id: "category-1", slug: "pratos", name: "Pratos", sortOrder: 1, _count: { products: 2 } },
    { id: "category-2", slug: "bebidas", name: "Bebidas", sortOrder: 2, _count: { products: 0 } },
  ];
  async version(): Promise<number> { return this.revision; }
  async list(): Promise<CategoryRow[]> { this.listCalls++; return this.rows; }
  async findById(id: string): Promise<CategoryRow | null> {
    this.detailCalls++; return this.rows.find((row) => row.id === id) ?? null;
  }
}

