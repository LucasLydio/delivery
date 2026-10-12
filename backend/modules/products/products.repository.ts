import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";
import type { SearchCriteria } from "../../utils/search";

const productInclude = {
  category: true,
  images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  optionGroups: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  },
} as const satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface ProductsRepository {
  version(): Promise<number>;
  list(criteria?: SearchCriteria): Promise<ProductRow[]>;
  findById(id: string): Promise<ProductRow | null>;
}

export class PrismaProductsRepository implements ProductsRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async version(): Promise<number> {
    const revision = await this.prisma.catalogRevision.findUnique({
      where: { id: "main" },
      select: { version: true },
    });
    if (!revision) throw new Error("Catalog revision is missing; run the commerce migration");
    return revision.version;
  }

  list(criteria: SearchCriteria = {}): Promise<ProductRow[]> {
    return this.prisma.product.findMany({
      where: criteria.query ? {
        OR: [
          { name: { contains: criteria.query, mode: "insensitive" } },
          { description: { contains: criteria.query, mode: "insensitive" } },
          { category: { name: { contains: criteria.query, mode: "insensitive" } } },
        ],
      } : undefined,
      include: productInclude,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findById(id: string): Promise<ProductRow | null> {
    return this.prisma.product.findUnique({ where: { id }, include: productInclude });
  }
}
