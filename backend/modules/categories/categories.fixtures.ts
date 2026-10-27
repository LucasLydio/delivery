import type { CategoriesRepository, CategoryRow } from './categories.repository';
import type { CategoryCache } from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

export class MemoryCategoryCache implements CategoryCache {
  readonly values = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

export class MemoryCategoriesRepository implements CategoriesRepository {
  revision = 1;
  listCalls = 0;
  detailCalls = 0;
  rows: CategoryRow[] = [
    {
      id: 'category-1',
      slug: 'pratos',
      name: 'Pratos',
      available: true,
      sortOrder: 1,
      _count: { products: 2 },
    },
    {
      id: 'category-2',
      slug: 'bebidas',
      name: 'Bebidas',
      available: true,
      sortOrder: 2,
      _count: { products: 0 },
    },
  ];
  async version(): Promise<number> {
    return this.revision;
  }
  async list(): Promise<CategoryRow[]> {
    this.listCalls++;
    return this.rows.filter((row) => row.available);
  }
  async findById(id: string): Promise<CategoryRow | null> {
    this.detailCalls++;
    return this.rows.find((row) => row.id === id && row.available) ?? null;
  }
  async listForAdmin(): Promise<CategoryRow[]> {
    return this.rows;
  }
  async slugExists(slug: string): Promise<boolean> {
    return this.rows.some((row) => row.slug === slug);
  }
  async create(input: CreateCategoryInput & { slug: string }): Promise<CategoryRow> {
    const row: CategoryRow = {
      id: `category-${this.rows.length + 1}`,
      ...input,
      available: true,
      _count: { products: 0 },
    };
    this.rows.push(row);
    this.revision++;
    return row;
  }
  async update(id: string, input: UpdateCategoryInput): Promise<CategoryRow | null> {
    const row = this.rows.find((category) => category.id === id);
    if (!row) return null;
    Object.assign(row, input);
    this.revision++;
    return row;
  }
}
