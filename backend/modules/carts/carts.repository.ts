import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";
import type { CartItemInput } from "../../../shared/commerce-contract";

const cartInclude = {
  items: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { selectedOptions: { orderBy: { optionId: "asc" } } },
  },
} as const satisfies Prisma.CartInclude;

const catalogSelect = {
  id: true,
  name: true,
  basePriceMinor: true,
  currency: true,
  available: true,
  optionGroups: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      minSelections: true,
      maxSelections: true,
      options: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true, priceDeltaMinor: true, available: true },
      },
    },
  },
} as const satisfies Prisma.ProductSelect;

type PrismaCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
export type CartCatalogProduct = Prisma.ProductGetPayload<{ select: typeof catalogSelect }>;

export interface CartRecord {
  id: string;
  customerId: string;
  revision: number;
  currency: string;
  items: CartItemInput[];
}

export type ReplaceCartResult =
  | { kind: "saved"; cart: CartRecord }
  | { kind: "conflict"; cart: CartRecord | null };

export interface CartsRepository {
  find(customerId: string): Promise<CartRecord | null>;
  products(productIds: string[]): Promise<CartCatalogProduct[]>;
  replace(customerId: string, expectedRevision: number | null, currency: string, items: CartItemInput[]): Promise<ReplaceCartResult>;
  delete(customerId: string): Promise<void>;
}

function toRecord(row: PrismaCart): CartRecord {
  if (!row.customerId) throw new Error("Authenticated cart has no customer");
  return {
    id: row.id,
    customerId: row.customerId,
    revision: row.revision,
    currency: row.currency,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      selectedOptionIds: item.selectedOptions.map((selection) => selection.optionId),
    })),
  };
}

export class PrismaCartsRepository implements CartsRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async find(customerId: string): Promise<CartRecord | null> {
    const row = await this.prisma.cart.findUnique({ where: { customerId }, include: cartInclude });
    return row ? toRecord(row) : null;
  }

  products(productIds: string[]): Promise<CartCatalogProduct[]> {
    if (productIds.length === 0) return Promise.resolve([]);
    return this.prisma.product.findMany({ where: { id: { in: productIds } }, select: catalogSelect });
  }

  replace(customerId: string, expectedRevision: number | null, currency: string, items: CartItemInput[]): Promise<ReplaceCartResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId} FOR UPDATE`;
      const current = await transaction.cart.findUnique({ where: { customerId }, include: cartInclude });
      if ((!current && expectedRevision !== null) || (current && current.revision !== expectedRevision)) {
        return { kind: "conflict", cart: current ? toRecord(current) : null };
      }

      if (!current) {
        const created = await transaction.cart.create({
          data: {
            customerId,
            currency,
            items: { create: items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              selectedOptions: { create: item.selectedOptionIds.map((optionId) => ({ optionId })) },
            })) },
          },
          include: cartInclude,
        });
        return { kind: "saved", cart: toRecord(created) };
      }

      await transaction.cartItem.deleteMany({ where: { cartId: current.id } });
      const updated = await transaction.cart.update({
        where: { id: current.id },
        data: {
          revision: { increment: 1 },
          currency,
          items: { create: items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            selectedOptions: { create: item.selectedOptionIds.map((optionId) => ({ optionId })) },
          })) },
        },
        include: cartInclude,
      });
      return { kind: "saved", cart: toRecord(updated) };
    });
  }

  async delete(customerId: string): Promise<void> {
    await this.prisma.cart.deleteMany({ where: { customerId } });
  }
}
