import type { Request, Response } from "express";
import type { CustomerAuthenticator } from "../../shared/authentication";
import { apiResponse } from "../../shared/response";
import { requireBearerToken, requireJson, requirePathId } from "../../utils/request";
import { createAddressSchema, updateAddressSchema } from "./addresses.schema";
import type { AddressesService } from "./addresses.service";

export class AddressesController {
  constructor(
    private readonly service: AddressesService,
    private readonly authenticator: CustomerAuthenticator,
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.list(await this.customerId(request)));
  };

  create = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const customerId = await this.customerId(request);
    apiResponse.post(response, await this.service.create(customerId, createAddressSchema.parse(request.body)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const customerId = await this.customerId(request);
    const addressId = requirePathId(request, "addressId", "address");
    apiResponse.patch(response, await this.service.update(customerId, addressId, updateAddressSchema.parse(request.body)));
  };

  setDefault = async (request: Request, response: Response): Promise<void> => {
    const customerId = await this.customerId(request);
    const addressId = requirePathId(request, "addressId", "address");
    apiResponse.patch(response, await this.service.setDefault(customerId, addressId));
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const customerId = await this.customerId(request);
    const addressId = requirePathId(request, "addressId", "address");
    await this.service.delete(customerId, addressId);
    apiResponse.delete(response);
  };

  private customerId(request: Request): Promise<string> {
    return this.authenticator.authenticate(requireBearerToken(request));
  }
}
