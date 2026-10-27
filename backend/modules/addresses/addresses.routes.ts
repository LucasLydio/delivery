import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AddressesController } from './addresses.controller';

export function createAddressesRoutes(controller: AddressesController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:addressId', asyncHandler(controller.update));
  router.patch('/:addressId/default', asyncHandler(controller.setDefault));
  router.delete('/:addressId', asyncHandler(controller.delete));
  return router;
}
