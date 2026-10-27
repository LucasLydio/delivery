import type { Request, Response } from "express";
import type { CustomerAuthenticator } from "../../shared/authentication";
import { apiResponse } from "../../shared/response";
import { requireBearerToken, requireJson } from "../../utils/request";
import { deletePushSchema, registerPushSchema } from "./push.schema";
import type { PushService } from "./push.service";

export class PushController {
  constructor(
    private readonly service: PushService,
    private readonly authenticator: CustomerAuthenticator,
  ) {}

  register = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const input = registerPushSchema.parse(request.body);
    await this.service.register(await this.customerId(request), input);
    apiResponse.post(response, { registered: true });
  };

  unregister = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const input = deletePushSchema.parse(request.body);
    apiResponse.delete(response, { removed: await this.service.unregister(await this.customerId(request), input) });
  };

  private customerId(request: Request): Promise<string> {
    return this.authenticator.authenticate(requireBearerToken(request));
  }
}
