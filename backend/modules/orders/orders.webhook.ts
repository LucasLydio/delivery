import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { ServiceUnavailableException, UnauthorizedException } from "../../shared/exceptions";
import { apiResponse } from "../../shared/response";
import type { OrdersService } from "./orders.service";

export function verifyMercadoPagoSignature(
  signature: string | undefined,
  requestId: string | undefined,
  dataId: string | undefined,
  secret: string | undefined,
): boolean {
  if (!signature || !requestId || !dataId || !secret) return false;
  const parts = new Map(signature.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
  const timestamp = parts.get("ts");
  const received = parts.get("v1");
  if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class MercadoPagoWebhookController {
  constructor(private readonly service: OrdersService, private readonly secret: string | undefined) {}

  receive = async (request: Request, response: Response): Promise<void> => {
    if (!this.secret) throw new ServiceUnavailableException("Mercado Pago webhook is not configured");
    const dataId = typeof request.query["data.id"] === "string"
      ? request.query["data.id"]
      : typeof request.body?.data?.id === "string" ? request.body.data.id : undefined;
    if (!verifyMercadoPagoSignature(request.header("x-signature"), request.header("x-request-id"), dataId, this.secret)) {
      throw new UnauthorizedException("Invalid Mercado Pago signature");
    }
    if (dataId) await this.service.reconcileMercadoPago(dataId);
    apiResponse.get(response, { received: true });
  };
}
