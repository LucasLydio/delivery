import { Prisma } from "@prisma/client";
import type { CheckoutQuote, OrderNotification, OrderPage, OrderSummary } from "../../../shared/commerce-contract";
import type { CheckoutLock } from "../../infra/redis/checkout-lock";
import { BadRequestException, ConflictException, NotFoundException, TooManyRequestsException } from "../../shared/exceptions";
import { priceCart } from "../carts/carts.service";
import type { MercadoPagoGateway } from "./orders.mercado-pago";
import { calculateCheckout, type Coordinates, type DeliveryPricing } from "./orders.pricing";
import type { OrderCursor, OrdersRepository } from "./orders.repository";
import type { CheckoutQuoteRequest, CheckoutRequest } from "./orders.schema";
import { noOpOrderNotifier, type OrderNotifier } from "../push/push.sender";

export interface OrdersConfiguration {
  currency: string;
  fallbackDeliveryPricing: DeliveryPricing;
  mercadoPagoFeePercent: number;
  shopLocation: Coordinates | null;
  quoteTtlSeconds: number;
  lockTtlMs: number;
  unpaidTimeoutMinutes: number;
}

export interface CheckoutResult { order: OrderSummary; replayed: boolean }

function encodeCursor(cursor: OrderCursor): string {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): OrderCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const createdAt = typeof parsed["createdAt"] === "string" ? new Date(parsed["createdAt"]) : new Date(Number.NaN);
    const id = parsed["id"];
    if (!Number.isFinite(createdAt.getTime()) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error();
    return { createdAt, id };
  } catch {
    throw new BadRequestException("Invalid order cursor");
  }
}

function locationFrom(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pin = value as Record<string, unknown>;
  return typeof pin.latitude === "number" && typeof pin.longitude === "number"
    ? { latitude: pin.latitude, longitude: pin.longitude }
    : null;
}

function addressSnapshot(address: Awaited<ReturnType<OrdersRepository["checkoutContext"]>>["address"], locationPin: Coordinates | null) {
  if (!address) return null;
  return {
    id: address.id, label: address.label, line1: address.line1, line2: address.line2,
    city: address.city, region: address.region, postalCode: address.postalCode,
    countryCode: address.countryCode, deliveryInstructions: address.deliveryInstructions, locationPin,
  };
}

export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly lock: CheckoutLock,
    private readonly mercadoPago: MercadoPagoGateway,
    private readonly config: OrdersConfiguration,
    private readonly now: () => Date = () => new Date(),
    private readonly notifier: OrderNotifier = noOpOrderNotifier,
  ) {}

  async quote(customerId: string, input: CheckoutQuoteRequest): Promise<CheckoutQuote> {
    return (await this.prepare(customerId, input)).quote;
  }

  async checkout(customerId: string, idempotencyKey: string, input: CheckoutRequest): Promise<CheckoutResult> {
    // A completed checkout has already consumed its cart, so replay lookup must happen first.
    // New checkouts perform the same lookup again while holding the cart lock.
    const replay = await this.repository.findByIdempotencyKey(customerId, idempotencyKey);
    if (replay) {
      if (replay.status === "PAYMENT_PENDING") throw new ConflictException("Checkout is still processing", { orderId: replay.id });
      return { order: replay, replayed: true };
    }
    const prepared = await this.prepare(customerId, {
      cartRevision: input.cartRevision,
      addressId: input.addressId,
      locationPin: input.locationPin,
      couponCode: input.couponCode,
      paymentMethod: input.payment.method,
    });
    const release = await this.lock.acquire(prepared.cartId, this.config.lockTtlMs);
    if (!release) throw new TooManyRequestsException("Checkout is already being processed", { retryAfterSeconds: Math.ceil(this.config.lockTtlMs / 1000) });
    try {
      const existing = await this.repository.findByIdempotencyKey(customerId, idempotencyKey);
      if (existing) {
        if (existing.status === "PAYMENT_PENDING") throw new ConflictException("Checkout is still processing", { orderId: existing.id });
        return { order: existing, replayed: true };
      }

      let order: OrderSummary;
      try {
        order = await this.repository.create({
          customerId,
          cartId: prepared.cartId,
          idempotencyKey,
          quote: prepared.quote,
          addressSnapshot: prepared.addressSnapshot,
          paymentExpiresAt: new Date(this.now().getTime() + this.config.unpaidTimeoutMinutes * 60_000),
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          throw new ConflictException("Cart changed during checkout");
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const concurrent = await this.repository.findByIdempotencyKey(customerId, idempotencyKey);
          if (concurrent?.status === "PAYMENT_PENDING") throw new ConflictException("Checkout is still processing", { orderId: concurrent.id });
          if (concurrent) return { order: concurrent, replayed: true };
        }
        throw error;
      }

      if (input.payment.method !== "MERCADO_PAGO_PIX" && input.payment.method !== "MERCADO_PAGO_CARD") {
        await this.notify(order);
        return { order, replayed: false };
      }
      const provider = await this.mercadoPago.create(order.id, order.totalMinor, order.currency, input.payment, idempotencyKey);
      order = await this.repository.updatePayment(order.id, {
        status: provider.outcome === "paid" ? "CONFIRMED" : provider.outcome === "failed" ? "PAYMENT_FAILED" : "PAYMENT_PENDING",
        paymentStatus: provider.outcome === "paid" ? "PAID" : provider.outcome === "failed" ? "FAILED" : "PENDING",
        mercadoPagoOrderId: provider.providerOrderId,
        mercadoPagoStatus: provider.status,
        paymentData: provider.paymentData,
        confirmedAt: provider.outcome === "paid" ? this.now() : null,
      });
      await this.notify(order);
      return { order, replayed: false };
    } finally {
      await release();
    }
  }

  async get(customerId: string, orderId: string): Promise<OrderSummary> {
    const order = await this.repository.get(customerId, orderId);
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async list(customerId: string, input: { limit: number; cursor?: string }): Promise<OrderPage> {
    const page = await this.repository.list(customerId, input.limit, decodeCursor(input.cursor));
    return { items: page.items, nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null };
  }
  events(customerId: string, after: bigint, limit = 100): Promise<OrderNotification[]> {
    return this.repository.events(customerId, after, Math.min(100, Math.max(1, limit)));
  }

  async reconcileMercadoPago(providerOrderId: string): Promise<OrderSummary | null> {
    const current = await this.repository.findByMercadoPagoId(providerOrderId);
    if (!current || current.status === "CONFIRMED" || current.status === "CANCELLED") return current;
    const provider = await this.mercadoPago.get(providerOrderId);
    if (provider.outcome === "failed" && ["canceled", "cancelled"].includes(provider.status)) {
      const cancelled = await this.repository.cancel(current.id, provider.status);
      await this.notify(cancelled);
      return cancelled;
    }
    const updated = await this.repository.updatePayment(current.id, {
      status: provider.outcome === "paid" ? "CONFIRMED" : provider.outcome === "failed" ? "PAYMENT_FAILED" : "PAYMENT_PENDING",
      paymentStatus: provider.outcome === "paid" ? "PAID" : provider.outcome === "failed" ? "FAILED" : "PENDING",
      mercadoPagoOrderId: provider.providerOrderId,
      mercadoPagoStatus: provider.status,
      paymentData: provider.paymentData,
      confirmedAt: provider.outcome === "paid" ? this.now() : null,
    });
    if (updated.status !== current.status || updated.paymentStatus !== current.paymentStatus) await this.notify(updated);
    return updated;
  }

  async cancelExpired(limit = 100): Promise<number> {
    const expired = await this.repository.expiredPending(this.now(), Math.min(100, Math.max(1, limit)));
    let cancelled = 0;
    for (const order of expired) {
      if (!order.mercadoPagoOrderId) continue;
      const provider = await this.mercadoPago.get(order.mercadoPagoOrderId);
      if (provider.outcome === "paid") {
        await this.reconcileMercadoPago(order.mercadoPagoOrderId);
        continue;
      }
      await this.mercadoPago.cancel(order.mercadoPagoOrderId, `cancel-${order.id}`);
      const cancelledOrder = await this.repository.cancel(order.id, "canceled");
      await this.notify(cancelledOrder);
      cancelled++;
    }
    return cancelled;
  }

  private async notify(order: OrderSummary): Promise<void> {
    try {
      await this.notifier.notify(order);
    } catch (error) {
      console.error("Order notification failed", {
        orderId: order.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async prepare(customerId: string, input: CheckoutQuoteRequest): Promise<{
    quote: CheckoutQuote; cartId: string; addressSnapshot: Record<string, unknown> | null;
  }> {
    const now = this.now();
    const context = await this.repository.checkoutContext(customerId, input.addressId, input.couponCode, now);
    if (!context.cart || context.cart.items.length === 0) throw new BadRequestException("Cart is empty");
    if (context.cart.currency !== this.config.currency) throw new BadRequestException("Cart currency is invalid");
    if (String(context.cart.revision) !== input.cartRevision) {
      throw new ConflictException("Cart revision conflict", { currentRevision: String(context.cart.revision) });
    }
    if (input.paymentMethod !== "PAY_AT_STORE" && !context.address) throw new NotFoundException("Address not found");
    if (input.couponCode && !context.coupon) throw new BadRequestException("Coupon is invalid or expired");
    const selectedLocation = input.locationPin ?? locationFrom(context.address?.locationPin);
    const quote = calculateCheckout({
      cartRevision: context.cart.revision,
      cart: priceCart(context.cart.items, context.products, this.config.currency),
      currency: this.config.currency,
      paymentMethod: input.paymentMethod,
      locationPin: selectedLocation,
      shopLocation: this.config.shopLocation,
      deliveryPricing: context.pricing ?? this.config.fallbackDeliveryPricing,
      mercadoPagoFeePercent: this.config.mercadoPagoFeePercent,
      couponCode: context.coupon?.code ?? null,
      discountPercent: context.coupon?.discountPercent ?? 0,
      expiresAt: new Date(now.getTime() + this.config.quoteTtlSeconds * 1000),
    });
    return { quote, cartId: context.cart.id, addressSnapshot: addressSnapshot(context.address, selectedLocation) };
  }
}

