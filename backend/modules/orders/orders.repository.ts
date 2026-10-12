import { Prisma, type PrismaClient } from "@prisma/client";
import type { CheckoutQuote, OrderNotification, OrderSummary } from "../../../shared/commerce-contract";
import { getPrisma } from "../../infra/prisma/client";
import type { AddressRecord } from "../addresses/addresses.repository";
import type { CartCatalogProduct, CartRecord } from "../carts/carts.repository";
import { PrismaCartsRepository } from "../carts/carts.repository";

const orderInclude = {
  items: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { selectedOptions: { orderBy: { id: "asc" } } },
  },
} as const satisfies Prisma.OrderInclude;
type PrismaOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface CouponRecord { code: string; discountPercent: number }
export interface PricingRecord { limitKm: number; feePerKmMinor: number }
export interface CheckoutContext {
  cart: CartRecord | null;
  products: CartCatalogProduct[];
  address: AddressRecord | null;
  coupon: CouponRecord | null;
  pricing: PricingRecord | null;
}

export interface CreateOrderInput {
  customerId: string;
  cartId: string;
  idempotencyKey: string;
  quote: CheckoutQuote;
  addressSnapshot: Record<string, unknown> | null;
  paymentExpiresAt: Date;
}

export interface UpdatePaymentInput {
  status: "PAYMENT_PENDING" | "CONFIRMED" | "PAYMENT_FAILED";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  mercadoPagoOrderId: string | null;
  mercadoPagoStatus: string;
  paymentData: Record<string, unknown> | null;
  confirmedAt: Date | null;
}

export interface OrdersRepository {
  checkoutContext(customerId: string, addressId: string | undefined, couponCode: string | undefined, now: Date): Promise<CheckoutContext>;
  findByIdempotencyKey(customerId: string, key: string): Promise<OrderSummary | null>;
  findByMercadoPagoId(providerOrderId: string): Promise<OrderSummary | null>;
  create(input: CreateOrderInput): Promise<OrderSummary>;
  updatePayment(orderId: string, input: UpdatePaymentInput): Promise<OrderSummary>;
  get(customerId: string, orderId: string): Promise<OrderSummary | null>;
  list(customerId: string): Promise<OrderSummary[]>;
  events(customerId: string, after: bigint, limit: number): Promise<OrderNotification[]>;
  expiredPending(now: Date, limit: number): Promise<OrderSummary[]>;
  cancel(orderId: string, providerStatus: string): Promise<OrderSummary>;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toSummary(row: PrismaOrder): OrderSummary {
  return {
    id: row.id,
    kind: "confirmed",
    status: row.status as OrderSummary["status"],
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod!,
    cartRevision: String(row.cartRevision ?? 0),
    currency: row.currency,
    lines: row.items.map((item) => ({
      itemId: item.id,
      productId: item.productId ?? "removed",
      name: item.name,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: item.lineTotalMinor,
      selectedOptions: item.selectedOptions.map((option) => ({
        id: option.optionId ?? option.id,
        name: option.name,
        priceDeltaMinor: option.priceDeltaMinor,
      })),
    })),
    subtotalMinor: row.subtotalMinor,
    deliveryFeeMinor: row.deliveryFeeMinor ?? 0,
    paymentFeeMinor: row.paymentFeeMinor,
    discountPercent: row.discountPercent,
    discountMinor: row.discountMinor,
    couponCode: row.couponCode,
    distanceMeters: row.distanceMeters,
    taxMinor: row.taxMinor ?? 0,
    totalMinor: row.totalMinor ?? 0,
    expiresAt: (row.quoteExpiresAt ?? row.createdAt).toISOString(),
    mercadoPagoStatus: row.mercadoPagoStatus,
    mercadoPagoOrderId: row.mercadoPagoOrderId,
    paymentData: jsonObject(row.paymentData),
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

export class PrismaOrdersRepository implements OrdersRepository {
  constructor(private readonly client?: PrismaClient) {}
  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async checkoutContext(customerId: string, addressId: string | undefined, couponCode: string | undefined, now: Date): Promise<CheckoutContext> {
    const carts = new PrismaCartsRepository(this.prisma);
    const cart = await carts.find(customerId);
    const [products, address, coupon, pricing] = await Promise.all([
      cart ? carts.products([...new Set(cart.items.map((item) => item.productId))]) : Promise.resolve([]),
      addressId ? this.prisma.address.findFirst({ where: { id: addressId, customerId } }) : Promise.resolve(null),
      couponCode ? this.prisma.coupon.findFirst({
        where: {
          code: couponCode.toUpperCase(), active: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
        select: { code: true, discountPercent: true },
      }) : Promise.resolve(null),
      this.prisma.deliveryPricingSetting.findUnique({ where: { id: "main" } }),
    ]);
    return {
      cart,
      products,
      address: address ? { ...address, locationPin: jsonObject(address.locationPin) as AddressRecord["locationPin"] } : null,
      coupon,
      pricing: pricing ? { limitKm: Number(pricing.limitKm), feePerKmMinor: pricing.feePerKmMinor } : null,
    };
  }

  async findByIdempotencyKey(customerId: string, key: string): Promise<OrderSummary | null> {
    const row = await this.prisma.order.findFirst({ where: { customerId, idempotencyKey: key }, include: orderInclude });
    return row ? toSummary(row) : null;
  }

  async findByMercadoPagoId(providerOrderId: string): Promise<OrderSummary | null> {
    const row = await this.prisma.order.findUnique({ where: { mercadoPagoOrderId: providerOrderId }, include: orderInclude });
    return row ? toSummary(row) : null;
  }

  create(input: CreateOrderInput): Promise<OrderSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await transaction.cart.findFirst({
        where: { id: input.cartId, customerId: input.customerId, revision: Number(input.quote.cartRevision) },
        select: { id: true },
      });
      if (!cart) throw new Prisma.PrismaClientKnownRequestError("Cart changed during checkout", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
      const created = await transaction.order.create({
        data: {
          customerId: input.customerId,
          idempotencyKey: input.idempotencyKey,
          status: input.quote.paymentMethod.startsWith("MERCADO_PAGO") ? "PAYMENT_PENDING" : "CONFIRMED",
          paymentMethod: input.quote.paymentMethod,
          paymentStatus: input.quote.paymentMethod === "PAY_ON_DELIVERY" ? "ON_DELIVERY"
            : input.quote.paymentMethod === "PAY_AT_STORE" ? "AT_STORE" : "PENDING",
          currency: input.quote.currency,
          cartRevision: Number(input.quote.cartRevision),
          subtotalMinor: input.quote.subtotalMinor,
          deliveryFeeMinor: input.quote.deliveryFeeMinor,
          paymentFeeMinor: input.quote.paymentFeeMinor,
          discountPercent: input.quote.discountPercent,
          discountMinor: input.quote.discountMinor,
          couponCode: input.quote.couponCode,
          taxMinor: input.quote.taxMinor,
          totalMinor: input.quote.totalMinor,
          distanceMeters: input.quote.distanceMeters,
          deliveryAddress: input.addressSnapshot as Prisma.InputJsonObject ?? Prisma.DbNull,
          quoteExpiresAt: new Date(input.quote.expiresAt),
          paymentExpiresAt: input.paymentExpiresAt,
          confirmedAt: input.quote.paymentMethod.startsWith("MERCADO_PAGO") ? null : new Date(),
          items: { create: input.quote.lines.map((line, sortOrder) => ({
            productId: line.productId,
            name: line.name,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            lineTotalMinor: line.lineTotalMinor,
            sortOrder,
            selectedOptions: { create: line.selectedOptions.map((option) => ({
              optionId: option.id,
              name: option.name,
              priceDeltaMinor: option.priceDeltaMinor,
            })) },
          })) },
          events: { create: {
            customerId: input.customerId,
            type: input.quote.paymentMethod.startsWith("MERCADO_PAGO") ? "order.payment_pending" : "order.confirmed",
            payload: { paymentMethod: input.quote.paymentMethod, totalMinor: input.quote.totalMinor },
          } },
        },
      });
      await transaction.cart.delete({ where: { id: cart.id } });
      return toSummary(await transaction.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude }));
    });
  }

  async updatePayment(orderId: string, input: UpdatePaymentInput): Promise<OrderSummary> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          paymentStatus: input.paymentStatus,
          mercadoPagoOrderId: input.mercadoPagoOrderId,
          mercadoPagoStatus: input.mercadoPagoStatus,
          paymentData: input.paymentData as Prisma.InputJsonObject ?? Prisma.DbNull,
          confirmedAt: input.confirmedAt,
          events: { create: {
            customerId: (await transaction.order.findUniqueOrThrow({ where: { id: orderId }, select: { customerId: true } })).customerId!,
            type: input.status === "CONFIRMED" ? "order.confirmed" : input.status === "PAYMENT_FAILED" ? "order.payment_failed" : "order.payment_pending",
            payload: { mercadoPagoStatus: input.mercadoPagoStatus },
          } },
        },
      });
      return toSummary(await transaction.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
    });
  }

  async get(customerId: string, orderId: string): Promise<OrderSummary | null> {
    const row = await this.prisma.order.findFirst({ where: { id: orderId, customerId }, include: orderInclude });
    return row ? toSummary(row) : null;
  }

  async list(customerId: string): Promise<OrderSummary[]> {
    return (await this.prisma.order.findMany({ where: { customerId }, include: orderInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })).map(toSummary);
  }

  async events(customerId: string, after: bigint, limit: number): Promise<OrderNotification[]> {
    return (await this.prisma.orderEvent.findMany({
      where: { customerId, id: { gt: after } }, orderBy: { id: "asc" }, take: limit,
    })).map((event) => ({
      id: event.id.toString(), orderId: event.orderId, type: event.type,
      payload: jsonObject(event.payload) ?? {}, createdAt: event.createdAt.toISOString(),
    }));
  }

  async expiredPending(now: Date, limit: number): Promise<OrderSummary[]> {
    return (await this.prisma.order.findMany({
      where: { status: "PAYMENT_PENDING", paymentExpiresAt: { lte: now } },
      orderBy: { paymentExpiresAt: "asc" }, take: limit, include: orderInclude,
    })).map(toSummary);
  }

  async cancel(orderId: string, providerStatus: string): Promise<OrderSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUniqueOrThrow({ where: { id: orderId }, select: { customerId: true } });
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED", paymentStatus: "CANCELLED", cancelledAt: new Date(), mercadoPagoStatus: providerStatus,
          events: { create: { customerId: current.customerId!, type: "order.cancelled", payload: { reason: "payment_timeout" } } },
        },
      });
      return toSummary(await transaction.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
    });
  }
}

