import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import type { CustomersController } from "./customers.controller";

export function createCustomersRoutes(controller: CustomersController): Router {
  const router = Router();
  router.post("/auth/login", asyncHandler(controller.login));
  router.post("/auth/refresh", asyncHandler(controller.refresh));
  router.delete("/auth/logout", asyncHandler(controller.logout));
  router.get("/me", asyncHandler(controller.me));
  router.patch("/me", asyncHandler(controller.updateMe));
  return router;
}
