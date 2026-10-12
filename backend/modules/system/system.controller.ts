import type { Request, Response } from "express";
import { apiResponse } from "../../shared/response";
import type { SystemService } from "./system.service";

export class SystemController {
  constructor(private readonly service: SystemService) {}

  health = async (_request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, this.service.health());
  };

  latestState = async (_request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.latestState());
  };

  pushConfig = async (_request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, this.service.pushConfig());
  };
}
