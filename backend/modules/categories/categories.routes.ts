import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import type { CategoriesController } from "./categories.controller";

export function createCategoriesRoutes(controller: CategoriesController): Router {
  const router = Router();
  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.findById));
  return router;
}

