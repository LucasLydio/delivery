import type { CheckoutPaymentMethod, CheckoutQuote } from '../../../shared/commerce-contract';
import { BadRequestException, ServiceUnavailableException } from '../../shared/exceptions';
import type { PricedCart } from '../carts/carts.service';

export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface DeliveryPricing {
  limitKm: number;
  feePerKmMinor: number;
}

export interface PriceCheckoutInput {
  cartRevision: number;
  cart: PricedCart;
  currency: string;
  paymentMethod: CheckoutPaymentMethod;
  locationPin: Coordinates | null;
  shopLocation: Coordinates | null;
  deliveryPricing: DeliveryPricing;
  mercadoPagoFeePercent: number;
  couponCode: string | null;
  discountPercent: number;
  expiresAt: Date;
}

export function parseMoneyToMinor(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid money configuration');
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error('Money configuration is too large');
  return amount;
}

export function distanceInMeters(left: Coordinates, right: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateCheckout(input: PriceCheckoutInput): CheckoutQuote {
  const storePickup = input.paymentMethod === 'PAY_AT_STORE';
  let distanceMeters: number | null = null;
  let deliveryFeeMinor = 0;
  if (!storePickup) {
    if (!input.locationPin) throw new BadRequestException('Delivery location is required');
    if (!input.shopLocation)
      throw new ServiceUnavailableException('Shop location is not configured');
    distanceMeters = distanceInMeters(input.shopLocation, input.locationPin);
    const excessKm = Math.max(0, Math.ceil(distanceMeters / 1000 - input.deliveryPricing.limitKm));
    deliveryFeeMinor = excessKm * input.deliveryPricing.feePerKmMinor;
  }

  const mercadoPago =
    input.paymentMethod === 'MERCADO_PAGO_PIX' || input.paymentMethod === 'MERCADO_PAGO_CARD';
  if (input.mercadoPagoFeePercent < 0 || input.mercadoPagoFeePercent >= 100) {
    throw new ServiceUnavailableException('Mercado Pago fee is misconfigured');
  }
  const grossSubtotal = mercadoPago
    ? Math.ceil(input.cart.subtotalMinor / (1 - input.mercadoPagoFeePercent / 100))
    : input.cart.subtotalMinor;
  const paymentFeeMinor = grossSubtotal - input.cart.subtotalMinor;
  const beforeDiscount = grossSubtotal + deliveryFeeMinor;
  const discountMinor = Math.floor((beforeDiscount * input.discountPercent) / 100);
  const totalMinor = beforeDiscount - discountMinor;
  for (const amount of [deliveryFeeMinor, paymentFeeMinor, discountMinor, totalMinor]) {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new BadRequestException('Calculated total is outside the supported range');
  }
  return {
    kind: 'confirmed',
    cartRevision: String(input.cartRevision),
    currency: input.currency,
    lines: input.cart.lines,
    subtotalMinor: input.cart.subtotalMinor,
    deliveryFeeMinor,
    paymentFeeMinor,
    discountPercent: input.discountPercent,
    discountMinor,
    couponCode: input.couponCode,
    distanceMeters,
    taxMinor: 0,
    totalMinor,
    paymentMethod: input.paymentMethod,
    expiresAt: input.expiresAt.toISOString(),
  };
}
