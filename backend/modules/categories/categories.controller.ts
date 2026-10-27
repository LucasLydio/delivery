import type { Request, Response } from 'express';
import { NotFoundException } from '../../shared/exceptions';
import { apiResponse } from '../../shared/response';
import { matchesEtag, publicCatalogHeaders } from '../../utils/http-cache';
import { requirePathId } from '../../utils/request';
import { requireBearerToken, requireJson } from '../../utils/request';
import type { StaffAuthenticator } from '../../shared/authentication';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import type { CategoriesService } from './categories.service';

export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const version = await this.service.version();
    const etag = `"categories-${version}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, await this.service.list(version));
  };

  findById = async (request: Request, response: Response): Promise<void> => {
    const id = requirePathId(request, 'id', 'category');
    const version = await this.service.version();
    const category = await this.service.findById(id, version);
    if (!category) throw new NotFoundException('Category not found');
    const etag = `"category-${id}-${version}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, category);
  };
}

export class AdminCategoriesController {
  constructor(
    private readonly service: CategoriesService,
    private readonly authenticator: StaffAuthenticator,
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    await this.authorize(request);
    apiResponse.get(response, { categories: await this.service.listForAdmin() });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.post(response, await this.service.create(createCategorySchema.parse(request.body)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.patch(
      response,
      await this.service.update(
        requirePathId(request, 'categoryId', 'category'),
        updateCategorySchema.parse(request.body),
      ),
    );
  };

  private async authorize(request: Request): Promise<void> {
    await this.authenticator.authenticate(requireBearerToken(request), ['ADMIN', 'MANAGER']);
  }
}
