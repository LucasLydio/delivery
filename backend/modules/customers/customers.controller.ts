import type { Request, Response } from "express";
import { apiResponse } from "../../shared/response";
import { readCookie, serializeHttpOnlyCookie } from "../../utils/cookies";
import { requireBearerToken, requireJson } from "../../utils/request";
import { customerLoginSchema, updateCustomerSchema } from "./customers.schema";
import type { CustomersService, IssuedCustomerSession } from "./customers.service";

export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly refreshCookieName: string,
    private readonly refreshTtlDays: number,
  ) {}

  login = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const result = await this.service.login(customerLoginSchema.parse(request.body));
    this.setRefreshCookie(request, response, result);
    apiResponse.post(response, this.publicSession(result));
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.refresh(readCookie(request.header("cookie"), this.refreshCookieName));
    this.setRefreshCookie(request, response, result);
    apiResponse.get(response, this.publicSession(result));
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await this.service.logout(readCookie(request.header("cookie"), this.refreshCookieName));
    response.setHeader("set-cookie", serializeHttpOnlyCookie(this.refreshCookieName, "", {
      secure: request.secure,
      maxAgeSeconds: 0,
      expires: new Date(0),
    }));
    apiResponse.delete(response);
  };

  me = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.me(requireBearerToken(request)));
  };

  updateMe = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const input = updateCustomerSchema.parse(request.body);
    apiResponse.patch(response, await this.service.updateMe(requireBearerToken(request), input));
  };

  private setRefreshCookie(request: Request, response: Response, result: IssuedCustomerSession): void {
    response.setHeader("set-cookie", serializeHttpOnlyCookie(this.refreshCookieName, result.refreshToken, {
      secure: request.secure,
      maxAgeSeconds: this.refreshTtlDays * 86_400,
      expires: result.refreshTokenExpiresAt,
    }));
  }

  private publicSession({ refreshToken: _token, refreshTokenExpiresAt: _expiry, ...session }: IssuedCustomerSession) {
    return session;
  }
}
