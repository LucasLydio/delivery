import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { UsersController } from './users.controller';

export function createUsersRoutes(controller: UsersController): Router {
  const router = Router();
  router.post('/auth/login', asyncHandler(controller.login));
  router.post('/auth/refresh', asyncHandler(controller.refresh));
  router.delete('/auth/logout', asyncHandler(controller.logout));
  router.get('/me', asyncHandler(controller.me));
  router.get('/users', asyncHandler(controller.list));
  router.post('/users', asyncHandler(controller.create));
  router.get('/users/:id', asyncHandler(controller.findById));
  router.patch('/users/:id', asyncHandler(controller.update));
  router.delete('/users/:id', asyncHandler(controller.delete));
  return router;
}
