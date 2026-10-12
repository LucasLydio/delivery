import { BadGatewayException, ServiceUnavailableException } from "../../shared/exceptions";
import type { CheckoutPayment } from "./orders.schema";

export interface MercadoPagoResult {
  providerOrderId: string | null;
  status: string;
  outcome: "paid" | "pending" | "failed";
  paymentData: Record<string, unknown> | null;
}

export interface MercadoPagoGateway {
  create(orderId: string, totalMinor: number, currency: string, payment: CheckoutPayment, idempotencyKey: string): Promise<MercadoPagoResult>;
  get(providerOrderId: string): Promise<MercadoPagoResult>;
  cancel(providerOrderId: string, idempotencyKey: string): Promise<void>;
}

function extractPaymentData(payload: Record<string, unknown>): Record<string, unknown> | null {
  const transactions = payload.transactions;
  if (typeof transactions !== "object" || transactions === null) return null;
  const payments = (transactions as Record<string, unknown>).payments;
  if (!Array.isArray(payments) || typeof payments[0] !== "object" || payments[0] === null) return null;
  const payment = payments[0] as Record<string, unknown>;
  const method = typeof payment.payment_method === "object" && payment.payment_method !== null
    ? payment.payment_method as Record<string, unknown>
    : {};
  const data: Record<string, unknown> = {};
  for (const [source, target] of [
    ["qr_code", "qrCode"],
    ["qr_code_base64", "qrCodeBase64"],
    ["ticket_url", "ticketUrl"],
  ] as const) {
    if (typeof method[source] === "string") data[target] = method[source];
  }
  return Object.keys(data).length ? data : null;
}

export class HttpMercadoPagoGateway implements MercadoPagoGateway {
  constructor(private readonly accessToken: string | undefined, private readonly apiUrl: string) {}

  async create(orderId: string, totalMinor: number, currency: string, payment: CheckoutPayment, idempotencyKey: string): Promise<MercadoPagoResult> {
    if (!this.accessToken) throw new ServiceUnavailableException("Mercado Pago is not configured");
    if (payment.method !== "MERCADO_PAGO_PIX" && payment.method !== "MERCADO_PAGO_CARD") {
      throw new Error("Offline payment cannot be sent to Mercado Pago");
    }
    const paymentMethod = payment.method === "MERCADO_PAGO_PIX"
      ? { id: "pix", type: "bank_transfer" }
      : {
          id: payment.paymentMethodId,
          type: payment.paymentType,
          token: payment.token,
          installments: payment.installments,
        };
    const body = {
      type: "online",
      processing_mode: "automatic",
      external_reference: orderId,
      total_amount: (totalMinor / 100).toFixed(2),
      currency,
      payer: payment.payer,
      transactions: { payments: [{ amount: (totalMinor / 100).toFixed(2), payment_method: paymentMethod }] },
    };

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/v1/orders`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException("Mercado Pago did not respond; payment status will be reconciled");
    }
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload.message === "string" ? payload.message : "Mercado Pago rejected the request";
      if (response.status >= 400 && response.status < 500) {
        return { providerOrderId: typeof payload.id === "string" ? payload.id : null, status: "failed", outcome: "failed", paymentData: { message } };
      }
      throw new BadGatewayException(message, { providerStatus: response.status });
    }
    if (typeof payload.id !== "string" || typeof payload.status !== "string") {
      throw new BadGatewayException("Mercado Pago returned an invalid response");
    }
    const outcome = payload.status === "processed"
      ? "paid"
      : ["failed", "canceled", "cancelled"].includes(payload.status) ? "failed" : "pending";
    return {
      providerOrderId: payload.id,
      status: payload.status,
      outcome,
      paymentData: extractPaymentData(payload),
    };
  }

  async get(providerOrderId: string): Promise<MercadoPagoResult> {
    const response = await this.request(`/v1/orders/${encodeURIComponent(providerOrderId)}`, { method: "GET" });
    return this.toResult(response);
  }

  async cancel(providerOrderId: string, idempotencyKey: string): Promise<void> {
    await this.request(`/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`, {
      method: "POST", headers: { "x-idempotency-key": idempotencyKey },
    });
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    if (!this.accessToken) throw new ServiceUnavailableException("Mercado Pago is not configured");
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.accessToken}`, "content-type": "application/json", ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException("Mercado Pago did not respond");
    }
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new BadGatewayException("Mercado Pago rejected the request", { providerStatus: response.status });
    return payload;
  }

  private toResult(payload: Record<string, unknown>): MercadoPagoResult {
    if (typeof payload.id !== "string" || typeof payload.status !== "string") {
      throw new BadGatewayException("Mercado Pago returned an invalid response");
    }
    return {
      providerOrderId: payload.id,
      status: payload.status,
      outcome: payload.status === "processed" ? "paid"
        : ["failed", "canceled", "cancelled"].includes(payload.status) ? "failed" : "pending",
      paymentData: extractPaymentData(payload),
    };
  }
}

