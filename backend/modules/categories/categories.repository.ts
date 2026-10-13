import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";

const categorySelect = {
  id: true,
  slug: true,
  name: true,
  sortOrder: true,
  _count: { select: { products: { where: { available: true } } } },
} as const satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

export interface CategoriesRepository {
  version(): Promise<number>;
  list(): Promise<CategoryRow[]>;
  findById(id: string): Promise<CategoryRow | null>;
}

export class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private readonly client?: PrismaClient) {}
  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async version(): Promise<number> {
    const revision = await this.prisma.catalogRevision.findUnique({ where: { id: "main" }, select: { version: true } });
    if (!revision) throw new Error("Catalog revision is missing; run the commerce migration");
    return revision.version;
  }

  list(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({ select: categorySelect, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  }

  findById(id: string): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { id }, select: categorySelect });
  }
}

