import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { CartsController } from './carts.controller';

export function createCartsRoutes(controller: CartsController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.get));
  router.put('/', asyncHandler(controller.synchronize));
  router.delete('/', asyncHandler(controller.clear));
  router.post('/quote', asyncHandler(controller.quote));
  return router;
}
