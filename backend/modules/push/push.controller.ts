import type { Request, Response } from "express";
import { apiResponse } from "../../shared/response";
import { requireJson } from "../../utils/request";
import { deletePushSchema, registerPushSchema } from "./push.schema";
import type { PushService } from "./push.service";

export class PushController {
  constructor(private readonly service: PushService) {}

  register = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const input = registerPushSchema.parse(request.body);
    await this.service.register(input);
    apiResponse.post(response, { registered: true });
  };

  unregister = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const input = deletePushSchema.parse(request.body);
    apiResponse.delete(response, { removed: await this.service.unregister(input) });
  };
}
