import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AdminCategoriesController, CategoriesController } from './categories.controller';

export function createCategoriesRoutes(controller: CategoriesController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.findById));
  return router;
}

export function createAdminCategoriesRoutes(controller: AdminCategoriesController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:categoryId', asyncHandler(controller.update));
  return router;
}
