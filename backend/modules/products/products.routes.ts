import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AdminProductsController, ProductsController } from './products.controller';

export function createProductsRoutes(controller: ProductsController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.findById));
  return router;
}

export function createAdminProductsRoutes(controller: AdminProductsController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.get('/:productId', asyncHandler(controller.findById));
  router.patch('/:productId', asyncHandler(controller.update));
  router.post('/:productId/option-groups', asyncHandler(controller.createOptionGroup));
  router.patch('/option-groups/:groupId', asyncHandler(controller.updateOptionGroup));
  router.post('/option-groups/:groupId/options', asyncHandler(controller.createOption));
  router.patch('/options/:optionId', asyncHandler(controller.updateOption));
  return router;
}
