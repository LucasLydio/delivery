import type {
  AdminCategory,
  CatalogCategory,
  CategorySnapshot,
} from '../../../shared/commerce-contract';
import { BadRequestException, ConflictException, NotFoundException } from '../../shared/exceptions';
import { createSlug } from '../../utils/slug';
import type { CategoriesRepository, CategoryRow } from './categories.repository';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

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

function toAdminCategory(row: CategoryRow): AdminCategory {
  return { ...toCatalogCategory(row), available: row.available };
}

export class CategoriesService {
  constructor(
    private readonly repository: CategoriesRepository,
    private readonly cache: CategoryCache,
    private readonly namespace: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  version(): Promise<number> {
    return this.repository.version();
  }

  async list(version: number): Promise<CategorySnapshot> {
    const key = `${this.namespace}:catalog:v${version}:categories`;
    const cached = await this.cache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as CategorySnapshot;
      } catch {
        /* Treat damaged cache data as a miss. */
      }
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
      try {
        return JSON.parse(cached) as CatalogCategory;
      } catch {
        /* Treat damaged cache data as a miss. */
      }
    }
    const row = await this.repository.findById(id);
    if (!row) return null;
    const category = toCatalogCategory(row);
    await this.cache.set(key, JSON.stringify(category), 300);
    return category;
  }

  async listForAdmin(): Promise<AdminCategory[]> {
    return (await this.repository.listForAdmin()).map(toAdminCategory);
  }

  async create(input: CreateCategoryInput): Promise<AdminCategory> {
    const slug = await this.availableSlug(input.name);
    return toAdminCategory(await this.repository.create({ ...input, slug }));
  }

  async update(id: string, input: UpdateCategoryInput): Promise<AdminCategory> {
    const category = await this.repository.update(id, input);
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return toAdminCategory(category);
  }

  private async availableSlug(name: string): Promise<string> {
    const base = createSlug(name);
    if (!base) throw new BadRequestException('O nome precisa conter letras ou números');
    if (!(await this.repository.slugExists(base))) return base;
    for (let suffix = 2; suffix <= 100; suffix++) {
      const candidate = `${base}-${suffix}`;
      if (!(await this.repository.slugExists(candidate))) return candidate;
    }
    throw new ConflictException('Não foi possível gerar um identificador único para a categoria');
  }
}
