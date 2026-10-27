import type {
  AdminProduct,
  CatalogProduct,
  CatalogSnapshot,
} from '../../../shared/commerce-contract';
import type { ProductStorage } from '../../config/storage';
import { BadRequestException, ConflictException, NotFoundException } from '../../shared/exceptions';
import { createSlug } from '../../utils/slug';
import type { ProductRow, ProductsRepository } from './products.repository';
import { searchCacheSegment, type SearchCriteria } from '../../utils/search';
import type {
  CreateOptionGroupInput,
  CreateProductInput,
  CreateProductOptionInput,
  UpdateOptionGroupInput,
  UpdateProductInput,
  UpdateProductOptionInput,
} from './products.schema';

export interface CatalogCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export function toCatalogProduct(row: ProductRow, storage: ProductStorage): CatalogProduct {
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
      url: storage.publicUrl(image.storageKey),
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

function toAdminProduct(row: ProductRow, storage: ProductStorage): AdminProduct {
  const product = toCatalogProduct(row, storage);
  return {
    ...product,
    sortOrder: row.sortOrder,
    optionGroups: row.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      sortOrder: group.sortOrder,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaMinor: option.priceDeltaMinor,
        available: option.available,
        sortOrder: option.sortOrder,
      })),
    })),
  };
}

export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly cache: CatalogCache,
    private readonly currency: string,
    private readonly storage: ProductStorage,
    private readonly namespace: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  version(): Promise<number> {
    return this.repository.version();
  }

  async list(version: number, criteria: SearchCriteria = {}): Promise<CatalogSnapshot> {
    const key = `${this.namespace}:catalog:v${version}:products:${searchCacheSegment(criteria)}`;
    const cached = await this.cache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as CatalogSnapshot;
      } catch {
        /* A damaged cache entry is treated as a miss. */
      }
    }

    const rows = await this.repository.list(criteria);
    if (rows.some((row) => row.currency !== this.currency))
      throw new Error('Catalog currency does not match brand currency');
    const snapshot: CatalogSnapshot = {
      version: String(version),
      fetchedAt: this.now().toISOString(),
      currency: this.currency,
      products: rows.map((row) => toCatalogProduct(row, this.storage)),
    };
    await this.cache.set(key, JSON.stringify(snapshot), 300);
    return snapshot;
  }

  async findById(id: string, version: number): Promise<CatalogProduct | null> {
    const key = `${this.namespace}:catalog:v${version}:product:${id}`;
    const cached = await this.cache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as CatalogProduct;
      } catch {
        /* A damaged cache entry is treated as a miss. */
      }
    }

    const row = await this.repository.findById(id);
    if (!row) return null;
    if (row.currency !== this.currency)
      throw new Error('Catalog currency does not match brand currency');
    const product = toCatalogProduct(row, this.storage);
    await this.cache.set(key, JSON.stringify(product), 300);
    return product;
  }

  async listForAdmin(): Promise<AdminProduct[]> {
    return (await this.repository.listForAdmin()).map((row) => toAdminProduct(row, this.storage));
  }

  async findByIdForAdmin(id: string): Promise<AdminProduct> {
    const product = await this.repository.findByIdForAdmin(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    return toAdminProduct(product, this.storage);
  }

  async create(input: CreateProductInput): Promise<AdminProduct> {
    await this.requireCategory(input.categoryId);
    const slug = await this.availableSlug(input.name);
    return toAdminProduct(
      await this.repository.create({ ...input, slug, currency: this.currency }),
      this.storage,
    );
  }

  async update(id: string, input: UpdateProductInput): Promise<AdminProduct> {
    if (input.categoryId) await this.requireCategory(input.categoryId);
    const product = await this.repository.update(id, input);
    if (!product) throw new NotFoundException('Produto não encontrado');
    return toAdminProduct(product, this.storage);
  }

  async createOptionGroup(productId: string, input: CreateOptionGroupInput): Promise<AdminProduct> {
    const product = await this.repository.createOptionGroup(productId, input);
    if (!product) throw new NotFoundException('Produto não encontrado');
    return toAdminProduct(product, this.storage);
  }

  async updateOptionGroup(groupId: string, input: UpdateOptionGroupInput): Promise<AdminProduct> {
    const current = await this.repository.findOptionGroup(groupId);
    if (!current) throw new NotFoundException('Grupo de opções não encontrado');
    const minimum = input.minSelections ?? current.minSelections;
    const maximum = input.maxSelections ?? current.maxSelections;
    if (maximum < minimum)
      throw new BadRequestException('O máximo de escolhas deve ser maior ou igual ao mínimo');
    const product = await this.repository.updateOptionGroup(groupId, input);
    if (!product) throw new NotFoundException('Grupo de opções não encontrado');
    return toAdminProduct(product, this.storage);
  }

  async createOption(groupId: string, input: CreateProductOptionInput): Promise<AdminProduct> {
    const product = await this.repository.createOption(groupId, input);
    if (!product) throw new NotFoundException('Grupo de opções não encontrado');
    return toAdminProduct(product, this.storage);
  }

  async updateOption(optionId: string, input: UpdateProductOptionInput): Promise<AdminProduct> {
    const product = await this.repository.updateOption(optionId, input);
    if (!product) throw new NotFoundException('Opção não encontrada');
    return toAdminProduct(product, this.storage);
  }

  private async requireCategory(categoryId: string): Promise<void> {
    if (!(await this.repository.categoryExists(categoryId)))
      throw new NotFoundException('Categoria não encontrada');
  }

  private async availableSlug(name: string): Promise<string> {
    const base = createSlug(name);
    if (!base) throw new BadRequestException('O nome precisa conter letras ou números');
    if (!(await this.repository.slugExists(base))) return base;
    for (let suffix = 2; suffix <= 100; suffix++) {
      const candidate = `${base}-${suffix}`;
      if (!(await this.repository.slugExists(candidate))) return candidate;
    }
    throw new ConflictException('Não foi possível gerar um identificador único para o produto');
  }
}
