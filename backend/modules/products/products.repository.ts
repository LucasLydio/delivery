import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';
import type { SearchCriteria } from '../../utils/search';
import type {
  CreateOptionGroupInput,
  CreateProductInput,
  CreateProductOptionInput,
  UpdateOptionGroupInput,
  UpdateProductInput,
  UpdateProductOptionInput,
} from './products.schema';

const productInclude = {
  category: true,
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  optionGroups: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { options: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  },
} as const satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface ProductsRepository {
  version(): Promise<number>;
  list(criteria?: SearchCriteria): Promise<ProductRow[]>;
  findById(id: string): Promise<ProductRow | null>;
  listForAdmin(): Promise<ProductRow[]>;
  findByIdForAdmin(id: string): Promise<ProductRow | null>;
  slugExists(slug: string): Promise<boolean>;
  categoryExists(categoryId: string): Promise<boolean>;
  create(input: CreateProductInput & { slug: string; currency: string }): Promise<ProductRow>;
  update(id: string, input: UpdateProductInput): Promise<ProductRow | null>;
  findOptionGroup(
    groupId: string,
  ): Promise<{ productId: string; minSelections: number; maxSelections: number } | null>;
  createOptionGroup(productId: string, input: CreateOptionGroupInput): Promise<ProductRow | null>;
  updateOptionGroup(groupId: string, input: UpdateOptionGroupInput): Promise<ProductRow | null>;
  createOption(groupId: string, input: CreateProductOptionInput): Promise<ProductRow | null>;
  updateOption(optionId: string, input: UpdateProductOptionInput): Promise<ProductRow | null>;
}

export class PrismaProductsRepository implements ProductsRepository {
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

  list(criteria: SearchCriteria = {}): Promise<ProductRow[]> {
    return this.prisma.product.findMany({
      where: {
        available: true,
        category: { available: true },
        ...(criteria.query
          ? {
              OR: [
                { name: { contains: criteria.query, mode: 'insensitive' } },
                { description: { contains: criteria.query, mode: 'insensitive' } },
                { category: { name: { contains: criteria.query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: productInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  findById(id: string): Promise<ProductRow | null> {
    return this.prisma.product.findFirst({
      where: { id, available: true, category: { available: true } },
      include: productInclude,
    });
  }

  listForAdmin(): Promise<ProductRow[]> {
    return this.prisma.product.findMany({
      include: productInclude,
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  findByIdForAdmin(id: string): Promise<ProductRow | null> {
    return this.prisma.product.findUnique({ where: { id }, include: productInclude });
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.prisma.product.count({ where: { slug } })) > 0;
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { id: categoryId } })) > 0;
  }

  create(input: CreateProductInput & { slug: string; currency: string }): Promise<ProductRow> {
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({ data: input, include: productInclude });
      await this.bumpRevision(transaction);
      return product;
    });
  }

  update(id: string, input: UpdateProductInput): Promise<ProductRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.product.updateMany({ where: { id }, data: input });
      if (changed.count !== 1) return null;
      await this.bumpRevision(transaction);
      return transaction.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    });
  }

  findOptionGroup(
    groupId: string,
  ): Promise<{ productId: string; minSelections: number; maxSelections: number } | null> {
    return this.prisma.productOptionGroup.findUnique({
      where: { id: groupId },
      select: { productId: true, minSelections: true, maxSelections: true },
    });
  }

  createOptionGroup(productId: string, input: CreateOptionGroupInput): Promise<ProductRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      if (
        !(await transaction.product.findUnique({ where: { id: productId }, select: { id: true } }))
      )
        return null;
      await transaction.productOptionGroup.create({ data: { productId, ...input } });
      await this.bumpRevision(transaction);
      return transaction.product.findUniqueOrThrow({
        where: { id: productId },
        include: productInclude,
      });
    });
  }

  updateOptionGroup(groupId: string, input: UpdateOptionGroupInput): Promise<ProductRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      const group = await transaction.productOptionGroup.findUnique({
        where: { id: groupId },
        select: { productId: true },
      });
      if (!group) return null;
      await transaction.productOptionGroup.update({ where: { id: groupId }, data: input });
      await this.bumpRevision(transaction);
      return transaction.product.findUniqueOrThrow({
        where: { id: group.productId },
        include: productInclude,
      });
    });
  }

  createOption(groupId: string, input: CreateProductOptionInput): Promise<ProductRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      const group = await transaction.productOptionGroup.findUnique({
        where: { id: groupId },
        select: { productId: true },
      });
      if (!group) return null;
      await transaction.productOption.create({ data: { groupId, ...input } });
      await this.bumpRevision(transaction);
      return transaction.product.findUniqueOrThrow({
        where: { id: group.productId },
        include: productInclude,
      });
    });
  }

  updateOption(optionId: string, input: UpdateProductOptionInput): Promise<ProductRow | null> {
    return this.prisma.$transaction(async (transaction) => {
      const option = await transaction.productOption.findUnique({
        where: { id: optionId },
        select: { group: { select: { productId: true } } },
      });
      if (!option) return null;
      await transaction.productOption.update({ where: { id: optionId }, data: input });
      await this.bumpRevision(transaction);
      return transaction.product.findUniqueOrThrow({
        where: { id: option.group.productId },
        include: productInclude,
      });
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
