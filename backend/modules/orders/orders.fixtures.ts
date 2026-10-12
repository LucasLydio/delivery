import type { CheckoutLock, ReleaseCheckoutLock } from "../../infra/redis/checkout-lock";
import type { CheckoutQuote, OrderNotification, OrderSummary } from "../../../shared/commerce-contract";
import type { MercadoPagoGateway, MercadoPagoResult } from "./orders.mercado-pago";
import type { CheckoutPayment } from "./orders.schema";
import type { CheckoutContext, CreateOrderInput, OrdersRepository, UpdatePaymentInput } from "./orders.repository";

export class MemoryCheckoutLock implements CheckoutLock {
  locked = false;
  acquisitionCount = 0;
  async acquire(): Promise<ReleaseCheckoutLock | null> {
    this.acquisitionCount++;
    if (this.locked) return null;
    this.locked = true;
    return async () => { this.locked = false; };
  }
}

export class FakeMercadoPagoGateway implements MercadoPagoGateway {
  calls: { orderId: string; payment: CheckoutPayment; key: string }[] = [];
  result: MercadoPagoResult = { providerOrderId: "mp-order-1", status: "processed", outcome: "paid", paymentData: null };
  async create(orderId: string, _totalMinor: number, _currency: string, payment: CheckoutPayment, key: string): Promise<MercadoPagoResult> {
    this.calls.push({ orderId, payment, key });
    return this.result;
  }
  async get(): Promise<MercadoPagoResult> { return this.result; }
  async cancel(): Promise<void> {}
}

function clone<T>(value: T): T { return structuredClone(value); }

export class MemoryOrdersRepository implements OrdersRepository {
  readonly orders = new Map<string, OrderSummary>();
  readonly keys = new Map<string, string>();
  cartPresent = true;
  context: CheckoutContext = {
    cart: {
      id: "cart-1", customerId: "customer-1", revision: 1, currency: "BRL",
      items: [{ id: "item-1", productId: "product-1", quantity: 1, selectedOptionIds: ["option-1"] }],
    },
    products: [{
      id: "product-1", name: "Poke de salmão", basePriceMinor: 2500, currency: "BRL", available: true,
      optionGroups: [{ id: "group-1", minSelections: 0, maxSelections: 1, options: [
        { id: "option-1", name: "Abacate", priceDeltaMinor: 300, available: true },
      ] }],
    }],
    address: {
      id: "address-1", customerId: "customer-1", label: "Casa", line1: "Rua Um, 10", line2: null,
      city: "São Paulo", region: "SP", postalCode: "01001000", countryCode: "BR",
      deliveryInstructions: null, locationPin: { latitude: -23.5505, longitude: -46.6333 },
      isDefault: true, createdAt: new Date(), updatedAt: new Date(),
    },
    coupon: null,
    pricing: null,
  };

  async checkoutContext(_customerId: string, _addressId: string | undefined, couponCode: string | undefined): Promise<CheckoutContext> {
    return {
      ...clone(this.context),
      cart: this.cartPresent ? clone(this.context.cart) : null,
      coupon: couponCode ? { code: couponCode.toUpperCase(), discountPercent: 10 } : null,
    };
  }

  async findByIdempotencyKey(_customerId: string, key: string): Promise<OrderSummary | null> {
    const id = this.keys.get(key);
    return id ? clone(this.orders.get(id)!) : null;
  }

  async create(input: CreateOrderInput): Promise<OrderSummary> {
    const id = `order-${this.orders.size + 1}`;
    const offline = !input.quote.paymentMethod.startsWith("MERCADO_PAGO");
    const order: OrderSummary = {
      ...clone(input.quote), id,
      status: offline ? "CONFIRMED" : "PAYMENT_PENDING",
      paymentStatus: input.quote.paymentMethod === "PAY_ON_DELIVERY" ? "ON_DELIVERY"
        : input.quote.paymentMethod === "PAY_AT_STORE" ? "AT_STORE" : "PENDING",
      mercadoPagoStatus: null, paymentData: null,
      mercadoPagoOrderId: null,
      createdAt: "2026-10-12T15:00:00.000Z",
      confirmedAt: offline ? "2026-10-12T15:00:00.000Z" : null,
      cancelledAt: null,
    };
    this.orders.set(id, order);
    this.keys.set(input.idempotencyKey, id);
    this.cartPresent = false;
    return clone(order);
  }

  async updatePayment(orderId: string, input: UpdatePaymentInput): Promise<OrderSummary> {
    const order = this.orders.get(orderId)!;
    Object.assign(order, {
      status: input.status, paymentStatus: input.paymentStatus,
      mercadoPagoStatus: input.mercadoPagoStatus, paymentData: input.paymentData,
      mercadoPagoOrderId: input.mercadoPagoOrderId,
      confirmedAt: input.confirmedAt?.toISOString() ?? null,
    });
    return clone(order);
  }

  async get(_customerId: string, orderId: string): Promise<OrderSummary | null> {
    const order = this.orders.get(orderId); return order ? clone(order) : null;
  }
  async findByMercadoPagoId(providerOrderId: string): Promise<OrderSummary | null> {
    return [...this.orders.values()].find((order) => order.mercadoPagoOrderId === providerOrderId) ?? null;
  }
  async list(): Promise<OrderSummary[]> { return [...this.orders.values()].map(clone); }
  async events(_customerId: string, _after: bigint, _limit: number): Promise<OrderNotification[]> { return []; }
  async expiredPending(): Promise<OrderSummary[]> { return [...this.orders.values()].filter((order) => order.status === "PAYMENT_PENDING"); }
  async cancel(orderId: string, providerStatus: string): Promise<OrderSummary> {
    const order = this.orders.get(orderId)!;
    Object.assign(order, { status: "CANCELLED", paymentStatus: "CANCELLED", cancelledAt: new Date().toISOString(), mercadoPagoStatus: providerStatus });
    return clone(order);
  }
}

