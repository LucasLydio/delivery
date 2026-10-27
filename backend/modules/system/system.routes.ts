import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import type { SystemController } from "./system.controller";

export function createSystemRoutes(controller: SystemController): Router {
  const router = Router();
  router.get("/health", asyncHandler(controller.health));
  router.get("/config/push-key", asyncHandler(controller.pushConfig));
  return router;
}
