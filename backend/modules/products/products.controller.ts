import type { Request, Response } from 'express';
import { BadRequestException, NotFoundException } from '../../shared/exceptions';
import { apiResponse } from '../../shared/response';
import { normalizeSearch, searchCacheSegment } from '../../utils/search';
import { matchesEtag, publicCatalogHeaders } from '../../utils/http-cache';
import type { ProductsService } from './products.service';
import type { StaffAuthenticator } from '../../shared/authentication';
import { requireBearerToken, requireJson, requirePathId } from '../../utils/request';
import {
  createOptionGroupSchema,
  createProductOptionSchema,
  createProductSchema,
  updateOptionGroupSchema,
  updateProductOptionSchema,
  updateProductSchema,
} from './products.schema';

export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const criteria = { query: normalizeSearch(request.query['q']) };
    const version = await this.service.version();
    const etag = `"catalog-${version}-${searchCacheSegment(criteria)}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, await this.service.list(version, criteria));
  };

  findById = async (request: Request, response: Response): Promise<void> => {
    const id = request.params['id'];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
      throw new BadRequestException('Invalid product ID');
    const version = await this.service.version();
    const product = await this.service.findById(id, version);
    if (!product) throw new NotFoundException('Product not found');
    const etag = `"product-${id}-${version}"`;
    response.set({ ...publicCatalogHeaders, etag });
    if (matchesEtag(request, etag)) {
      response.status(304).end();
      return;
    }
    apiResponse.get(response, product);
  };
}

export class AdminProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly authenticator: StaffAuthenticator,
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    await this.authorize(request);
    apiResponse.get(response, { products: await this.service.listForAdmin() });
  };

  findById = async (request: Request, response: Response): Promise<void> => {
    await this.authorize(request);
    apiResponse.get(
      response,
      await this.service.findByIdForAdmin(requirePathId(request, 'productId', 'product')),
    );
  };

  create = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.post(response, await this.service.create(createProductSchema.parse(request.body)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.patch(
      response,
      await this.service.update(
        requirePathId(request, 'productId', 'product'),
        updateProductSchema.parse(request.body),
      ),
    );
  };

  createOptionGroup = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.post(
      response,
      await this.service.createOptionGroup(
        requirePathId(request, 'productId', 'product'),
        createOptionGroupSchema.parse(request.body),
      ),
    );
  };

  updateOptionGroup = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.patch(
      response,
      await this.service.updateOptionGroup(
        requirePathId(request, 'groupId', 'option group'),
        updateOptionGroupSchema.parse(request.body),
      ),
    );
  };

  createOption = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.post(
      response,
      await this.service.createOption(
        requirePathId(request, 'groupId', 'option group'),
        createProductOptionSchema.parse(request.body),
      ),
    );
  };

  updateOption = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    await this.authorize(request);
    apiResponse.patch(
      response,
      await this.service.updateOption(
        requirePathId(request, 'optionId', 'option'),
        updateProductOptionSchema.parse(request.body),
      ),
    );
  };

  private async authorize(request: Request): Promise<void> {
    await this.authenticator.authenticate(requireBearerToken(request), ['ADMIN', 'MANAGER']);
  }
}
