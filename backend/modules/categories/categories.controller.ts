import type { Request, Response } from "express";
import { NotFoundException } from "../../shared/exceptions";
import { apiResponse } from "../../shared/response";
import { matchesEtag, publicCatalogHeaders } from "../../utils/http-cache";
import { requirePathId } from "../../utils/request";
import type { CategoriesService } from "./categories.service";

export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const version = await this.service.version();
    const etag = `"categories-${version}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) { response.status(304).end(); return; }
    apiResponse.get(response, await this.service.list(version));
  };

  findById = async (request: Request, response: Response): Promise<void> => {
    const id = requirePathId(request, "id", "category");
    const version = await this.service.version();
    const category = await this.service.findById(id, version);
    if (!category) throw new NotFoundException("Category not found");
    const etag = `"category-${id}-${version}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) { response.status(304).end(); return; }
    apiResponse.get(response, category);
  };
}

