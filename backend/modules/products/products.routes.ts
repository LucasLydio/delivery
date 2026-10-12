import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import type { ProductsController } from "./products.controller";

export function createProductsRoutes(controller: ProductsController): Router {
  const router = Router();
  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.findById));
  return router;
}
