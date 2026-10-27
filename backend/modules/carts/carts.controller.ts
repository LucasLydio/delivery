import type { Request, Response } from 'express';
import type { CustomerAuthenticator } from '../../shared/authentication';
import { apiResponse } from '../../shared/response';
import { requireBearerToken, requireJson } from '../../utils/request';
import { synchronizeCartSchema } from './carts.schema';
import type { CartsService } from './carts.service';

export class CartsController {
  constructor(
    private readonly service: CartsService,
    private readonly authenticator: CustomerAuthenticator,
  ) {}

  get = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.get(await this.customerId(request)));
  };

  synchronize = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const customerId = await this.customerId(request);
    apiResponse.put(
      response,
      await this.service.synchronize(customerId, synchronizeCartSchema.parse(request.body)),
    );
  };

  clear = async (request: Request, response: Response): Promise<void> => {
    await this.service.clear(await this.customerId(request));
    apiResponse.delete(response);
  };

  quote = async (request: Request, response: Response): Promise<void> => {
    apiResponse.post(response, await this.service.quote(await this.customerId(request)));
  };

  private customerId(request: Request): Promise<string> {
    return this.authenticator.authenticate(requireBearerToken(request));
  }
}
