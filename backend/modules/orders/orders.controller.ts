import type { Request, Response } from 'express';
import type { CustomerAuthenticator, StaffAuthenticator } from '../../shared/authentication';
import { BadRequestException } from '../../shared/exceptions';
import { apiResponse } from '../../shared/response';
import { requireBearerToken, requireJson, requirePathId } from '../../utils/request';
import {
  adminOrderListQuerySchema,
  checkoutQuoteRequestSchema,
  checkoutRequestSchema,
} from './orders.schema';
import {
  orderEventCursorSchema,
  orderListQuerySchema,
  updateOrderStatusSchema,
} from './orders.schema';
import type { OrdersService } from './orders.service';

export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly authenticator: CustomerAuthenticator,
  ) {}

  quote = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    apiResponse.post(
      response,
      await this.service.quote(
        await this.customerId(request),
        checkoutQuoteRequestSchema.parse(request.body),
      ),
    );
  };

  checkout = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const key = request.header('x-idempotency-key')?.trim();
    if (!key || key.length > 128 || !/^[\x21-\x7E]+$/.test(key))
      throw new BadRequestException('Valid X-Idempotency-Key header required');
    const result = await this.service.checkout(
      await this.customerId(request),
      key,
      checkoutRequestSchema.parse(request.body),
    );
    if (result.replayed) apiResponse.get(response, result.order, { 'x-idempotent-replay': 'true' });
    else apiResponse.post(response, result.order);
  };

  list = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(
      response,
      await this.service.list(
        await this.customerId(request),
        orderListQuerySchema.parse(request.query),
      ),
    );
  };

  events = async (request: Request, response: Response): Promise<void> => {
    const rawCursor = typeof request.query.after === 'string' ? request.query.after : '0';
    apiResponse.get(
      response,
      await this.service.events(
        await this.customerId(request),
        orderEventCursorSchema.parse(rawCursor),
      ),
    );
  };

  get = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(
      response,
      await this.service.get(
        await this.customerId(request),
        requirePathId(request, 'orderId', 'order'),
      ),
    );
  };

  private customerId(request: Request): Promise<string> {
    return this.authenticator.authenticate(requireBearerToken(request));
  }
}

export class AdminOrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly authenticator: StaffAuthenticator,
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    await this.authenticator.authenticate(requireBearerToken(request), ['ADMIN', 'MANAGER']);
    apiResponse.get(
      response,
      await this.service.listForAdmin(adminOrderListQuerySchema.parse(request.query)),
    );
  };

  updateStatus = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const actor = await this.authenticator.authenticate(requireBearerToken(request), [
      'ADMIN',
      'MANAGER',
    ]);
    apiResponse.patch(
      response,
      await this.service.updateStatus(
        actor.id,
        requirePathId(request, 'orderId', 'order'),
        updateOrderStatusSchema.parse(request.body),
      ),
    );
  };
}
