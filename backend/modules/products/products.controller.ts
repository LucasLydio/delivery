import type { Request, Response } from "express";
import { BadRequestException, NotFoundException } from "../../shared/exceptions";
import { apiResponse } from "../../shared/response";
import { normalizeSearch, searchCacheSegment } from "../../utils/search";
import type { ProductsService } from "./products.service";

const revalidateHeaders = { "cache-control": "public, max-age=0, must-revalidate" };

function matchesEtag(request: Request, etag: string): boolean {
  return request.headers["if-none-match"]?.split(",").some((tag) => tag.trim() === etag) ?? false;
}

export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const criteria = { query: normalizeSearch(request.query["q"]) };
    const version = await this.service.version();
    const etag = `"catalog-${version}-${searchCacheSegment(criteria)}"`;
    response.set({ ...revalidateHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, await this.service.list(version, criteria));
  };

  findById = async (request: Request, response: Response): Promise<void> => {
    const id = request.params["id"];
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new BadRequestException("Invalid product ID");
    const version = await this.service.version();
    const product = await this.service.findById(id, version);
    if (!product) throw new NotFoundException("Product not found");
    const etag = `"product-${id}-${version}"`;
    response.set({ ...revalidateHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, product);
  };
}
