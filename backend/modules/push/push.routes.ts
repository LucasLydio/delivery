import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import type { PushController } from "./push.controller";

export function createPushRoutes(controller: PushController): Router {
  const router = Router();
  router.post("/subscriptions", asyncHandler(controller.register));
  router.delete("/subscriptions", asyncHandler(controller.unregister));
  return router;
}
