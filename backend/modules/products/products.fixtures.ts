import type { ProductRow, ProductsRepository } from './products.repository';
import type { CatalogCache } from './products.service';
import type { SearchCriteria } from '../../utils/search';
import type {
  CreateOptionGroupInput,
  CreateProductInput,
  CreateProductOptionInput,
  UpdateOptionGroupInput,
  UpdateProductInput,
  UpdateProductOptionInput,
} from './products.schema';

export function productFixture(): ProductRow {
  return {
    id: 'product-1',
    slug: 'poke',
    name: 'Poke',
    description: 'Fresco',
    categoryId: 'category-1',
    category: { id: 'category-1', name: 'Pratos' },
    basePriceMinor: 2590,
    currency: 'BRL',
    available: true,
    images: [{ storageKey: 'menu/poke 1.webp', alt: 'Poke', width: 640, height: 640 }],
    optionGroups: [
      {
        id: 'group-1',
        name: 'Extras',
        minSelections: 0,
        maxSelections: 2,
        options: [{ id: 'option-1', name: 'Abacate', priceDeltaMinor: 350, available: true }],
      },
    ],
  } as ProductRow;
}

export class MemoryCache implements CatalogCache {
  readonly values = new Map<string, string>();
  readonly ttl = new Map<string, number>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
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
  async version() {
    return this.revision;
  }
  async list(criteria?: SearchCriteria) {
    this.listCalls++;
    this.lastCriteria = criteria;
    return this.rows.filter((row) => row.available);
  }
  async findById(id: string) {
    this.detailCalls++;
    return this.rows.find((row) => row.id === id && row.available) ?? null;
  }
  async listForAdmin() {
    return this.rows;
  }
  async findByIdForAdmin(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async slugExists(slug: string) {
    return this.rows.some((row) => row.slug === slug);
  }
  async categoryExists(categoryId: string) {
    return categoryId === 'category-1' || this.rows.some((row) => row.categoryId === categoryId);
  }
  async create(
    input: CreateProductInput & { slug: string; currency: string },
  ): Promise<ProductRow> {
    const now = new Date();
    const row = {
      id: `product-${this.rows.length + 1}`,
      ...input,
      available: true,
      category: {
        id: input.categoryId,
        name: 'Pratos',
        slug: 'pratos',
        available: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      images: [],
      optionGroups: [],
      createdAt: now,
      updatedAt: now,
    } satisfies ProductRow;
    this.rows.push(row);
    this.revision++;
    return row;
  }
  async update(id: string, input: UpdateProductInput): Promise<ProductRow | null> {
    const row = this.rows.find((product) => product.id === id);
    if (!row) return null;
    Object.assign(row, input);
    this.revision++;
    return row;
  }
  async findOptionGroup(groupId: string) {
    for (const product of this.rows) {
      const group = product.optionGroups.find((item) => item.id === groupId);
      if (group)
        return {
          productId: product.id,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
        };
    }
    return null;
  }
  async createOptionGroup(
    productId: string,
    input: CreateOptionGroupInput,
  ): Promise<ProductRow | null> {
    const product = this.rows.find((row) => row.id === productId);
    if (!product) return null;
    product.optionGroups.push({
      id: `group-${product.optionGroups.length + 1}`,
      productId,
      ...input,
      options: [],
    });
    this.revision++;
    return product;
  }
  async updateOptionGroup(
    groupId: string,
    input: UpdateOptionGroupInput,
  ): Promise<ProductRow | null> {
    for (const product of this.rows) {
      const group = product.optionGroups.find((item) => item.id === groupId);
      if (group) {
        Object.assign(group, input);
        this.revision++;
        return product;
      }
    }
    return null;
  }
  async createOption(groupId: string, input: CreateProductOptionInput): Promise<ProductRow | null> {
    for (const product of this.rows) {
      const group = product.optionGroups.find((item) => item.id === groupId);
      if (group) {
        group.options.push({
          id: `option-${group.options.length + 1}`,
          groupId,
          ...input,
          available: true,
        });
        this.revision++;
        return product;
      }
    }
    return null;
  }
  async updateOption(
    optionId: string,
    input: UpdateProductOptionInput,
  ): Promise<ProductRow | null> {
    for (const product of this.rows) {
      for (const group of product.optionGroups) {
        const option = group.options.find((item) => item.id === optionId);
        if (option) {
          Object.assign(option, input);
          this.revision++;
          return product;
        }
      }
    }
    return null;
  }
}
