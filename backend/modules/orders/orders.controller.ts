import type { Request, Response } from "express";
import type { CustomerAuthenticator } from "../../shared/authentication";
import { BadRequestException } from "../../shared/exceptions";
import { apiResponse } from "../../shared/response";
import { requireBearerToken, requireJson, requirePathId } from "../../utils/request";
import { checkoutQuoteRequestSchema, checkoutRequestSchema } from "./orders.schema";
import { orderEventCursorSchema } from "./orders.schema";
import type { OrdersService } from "./orders.service";

export class OrdersController {
  constructor(private readonly service: OrdersService, private readonly authenticator: CustomerAuthenticator) {}

  quote = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    apiResponse.post(response, await this.service.quote(await this.customerId(request), checkoutQuoteRequestSchema.parse(request.body)));
  };

  checkout = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const key = request.header("x-idempotency-key")?.trim();
    if (!key || key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) throw new BadRequestException("Valid X-Idempotency-Key header required");
    const result = await this.service.checkout(await this.customerId(request), key, checkoutRequestSchema.parse(request.body));
    if (result.replayed) apiResponse.get(response, result.order, { "x-idempotent-replay": "true" });
    else apiResponse.post(response, result.order);
  };

  list = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.list(await this.customerId(request)));
  };

  events = async (request: Request, response: Response): Promise<void> => {
    const rawCursor = typeof request.query.after === "string" ? request.query.after : "0";
    apiResponse.get(response, await this.service.events(await this.customerId(request), orderEventCursorSchema.parse(rawCursor)));
  };

  get = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.get(await this.customerId(request), requirePathId(request, "orderId", "order")));
  };

  private customerId(request: Request): Promise<string> {
    return this.authenticator.authenticate(requireBearerToken(request));
  }
}

