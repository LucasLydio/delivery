import { z } from "zod";

const locationPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional(),
}).strict();

const payerSchema = z.object({
  email: z.email(),
  identification: z.object({
    type: z.string().trim().min(1).max(16),
    number: z.string().trim().min(1).max(32),
  }).strict().optional(),
}).strict();

const pixPaymentSchema = z.object({
  method: z.literal("MERCADO_PAGO_PIX"),
  payer: payerSchema,
}).strict();

const cardPaymentSchema = z.object({
  method: z.literal("MERCADO_PAGO_CARD"),
  paymentMethodId: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/i),
  paymentType: z.enum(["credit_card", "debit_card"]),
  token: z.string().min(16).max(512),
  installments: z.number().int().min(1).max(24),
  payer: payerSchema,
}).strict();

const offlinePaymentSchema = z.object({
  method: z.enum(["PAY_ON_DELIVERY", "PAY_AT_STORE"]),
}).strict();

export const checkoutRequestSchema = z.object({
  cartRevision: z.string().regex(/^[1-9]\d{0,9}$/),
  addressId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  locationPin: locationPinSchema.optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
  payment: z.discriminatedUnion("method", [pixPaymentSchema, cardPaymentSchema, offlinePaymentSchema]),
}).strict().superRefine((input, context) => {
  if (input.payment.method !== "PAY_AT_STORE" && !input.addressId) {
    context.addIssue({ code: "custom", path: ["addressId"], message: "Address is required for delivery" });
  }
});

export const checkoutQuoteRequestSchema = z.object({
  cartRevision: z.string().regex(/^[1-9]\d{0,9}$/),
  addressId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  locationPin: locationPinSchema.optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
  paymentMethod: z.enum(["MERCADO_PAGO_PIX", "MERCADO_PAGO_CARD", "PAY_ON_DELIVERY", "PAY_AT_STORE"]),
}).strict().superRefine((input, context) => {
  if (input.paymentMethod !== "PAY_AT_STORE" && !input.addressId) {
    context.addIssue({ code: "custom", path: ["addressId"], message: "Address is required for delivery" });
  }
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutPayment = CheckoutRequest["payment"];
export type CheckoutQuoteRequest = z.infer<typeof checkoutQuoteRequestSchema>;

export const orderEventCursorSchema = z.string().regex(/^\d+$/).transform(BigInt);

