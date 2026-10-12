import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCheckout, distanceInMeters, parseMoneyToMinor } from "./orders.pricing";

const cart = {
  subtotalMinor: 10_000,
  lines: [{ itemId: "i", productId: "p", name: "Produto", quantity: 1, selectedOptions: [], unitPriceMinor: 10_000, lineTotalMinor: 10_000 }],
};

test("checkout pricing uses whole excess kilometers, Mercado Pago gross-up, then coupon", () => {
  const quote = calculateCheckout({
    cartRevision: 2, cart, currency: "BRL", paymentMethod: "MERCADO_PAGO_PIX",
    shopLocation: { latitude: 0, longitude: 0 }, locationPin: { latitude: 0.027, longitude: 0 },
    deliveryPricing: { limitKm: 1, feePerKmMinor: 200 }, mercadoPagoFeePercent: 10,
    couponCode: "DEZ", discountPercent: 10, expiresAt: new Date("2026-10-12T15:05:00Z"),
  });
  assert.ok(quote.distanceMeters! > 2_900 && quote.distanceMeters! < 3_100);
  // 3.002 km is billed as three started kilometers beyond the included first km.
  assert.equal(quote.deliveryFeeMinor, 600);
  assert.equal(quote.paymentFeeMinor, 1112);
  assert.equal(quote.discountMinor, 1171);
  assert.equal(quote.totalMinor, 10_541);
});

test("store pickup has no distance or payment fee", () => {
  const quote = calculateCheckout({
    cartRevision: 1, cart, currency: "BRL", paymentMethod: "PAY_AT_STORE",
    shopLocation: null, locationPin: null, deliveryPricing: { limitKm: 0, feePerKmMinor: 999 },
    mercadoPagoFeePercent: 12, couponCode: null, discountPercent: 0, expiresAt: new Date(),
  });
  assert.equal(quote.distanceMeters, null);
  assert.equal(quote.deliveryFeeMinor, 0);
  assert.equal(quote.paymentFeeMinor, 0);
  assert.equal(quote.totalMinor, 10_000);
  assert.equal(parseMoneyToMinor("12.30"), 1230);
  assert.equal(distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
});

