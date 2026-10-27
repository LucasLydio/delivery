import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

const categorySelect = {
  id: true,
  slug: true,
  name: true,
  available: true,
  sortOrder: true,
  _count: { select: { products: { where: { available: true } } } },
} as const satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

export interface CategoriesRepository {
  version(): Promise<number>;
  list(): Promise<CategoryRow[]>;
  findById(id: string): Promise<CategoryRow | null>;
  listForAdmin(): Promise<CategoryRow[]>;
  slugExists(slug: string): Promise<boolean>;
  create(input: CreateCategoryInput & { slug: string }): Promise<CategoryRow>;
  update(id: string, input: UpdateCategoryInput): Promise<CategoryRow | null>;
}

export class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private readonly client?: PrismaClient) {}
  private get prisma(): PrismaClient {
    return this.client ?? getPrisma();
  }

  async version(): Promise<number> {
    const revision = await this.prisma.catalogRevision.findUnique({
      where: { id: 'main' },
      select: { version: true },
    });
    if (!revision) throw new Error('Catalog revision is missing; run the commerce migration');
    return revision.version;
  }

  list(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      where: { available: true },
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  findById(id: string): Promise<CategoryRow | null> {
    return this.prisma.category.findFirst({
      where: { id, available: true },
      select: categorySelect,
    });
  }

  listForAdmin(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { slug } })) > 0;
  }

  create(input: CreateCategoryInput & { slug: string }): Promise<CategoryRow> {
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.create({ data: input, select: categorySelect });
      await this.bumpRevision(transaction);
      return category;
    });
  }

  update(id: string, input: UpdateCategoryInput): Promise<CategoryRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.category.updateMany({ where: { id }, data: input });
      if (changed.count !== 1) return null;
      await this.bumpRevision(transaction);
      return transaction.category.findUniqueOrThrow({ where: { id }, select: categorySelect });
    });
  }

  private async bumpRevision(transaction: Prisma.TransactionClient): Promise<void> {
    await transaction.catalogRevision.upsert({
      where: { id: 'main' },
      create: { id: 'main', version: 1 },
      update: { version: { increment: 1 } },
    });
  }
}
