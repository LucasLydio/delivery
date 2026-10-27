import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AdminOrdersController, OrdersController } from './orders.controller';
import type { MercadoPagoWebhookController } from './orders.webhook';

export function createCheckoutRoutes(controller: OrdersController): Router {
  const router = Router();
  router.post('/quote', asyncHandler(controller.quote));
  router.post('/', asyncHandler(controller.checkout));
  return router;
}

export function createOrdersWebhookRoutes(controller: MercadoPagoWebhookController): Router {
  const router = Router();
  router.post('/mercado-pago', asyncHandler(controller.receive));
  return router;
}

export function createOrdersRoutes(controller: OrdersController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/events', asyncHandler(controller.events));
  router.get('/:orderId', asyncHandler(controller.get));
  return router;
}

export function createAdminOrdersRoutes(controller: AdminOrdersController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.patch('/:orderId/status', asyncHandler(controller.updateStatus));
  return router;
}
