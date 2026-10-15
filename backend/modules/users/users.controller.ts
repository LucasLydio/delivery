import type { Request, Response } from "express";
import { apiResponse } from "../../shared/response";
import { readCookie, serializeHttpOnlyCookie } from "../../utils/cookies";
import { requireBearerToken, requireJson, requirePathId } from "../../utils/request";
import { createUserSchema, listUsersSchema, updateUserSchema, userLoginSchema } from "./users.schema";
import type { IssuedUserSession, UsersService } from "./users.service";

export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly refreshCookieName: string,
    private readonly refreshTtlDays: number,
  ) {}

  login = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    const result = await this.service.login(userLoginSchema.parse(request.body));
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
      secure: request.secure, path: "/api/admin/auth", maxAgeSeconds: 0, expires: new Date(0),
    }));
    apiResponse.delete(response);
  };
  me = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.me(requireBearerToken(request)));
  };
  list = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.list(requireBearerToken(request), listUsersSchema.parse(request.query)));
  };
  findById = async (request: Request, response: Response): Promise<void> => {
    apiResponse.get(response, await this.service.findById(requireBearerToken(request), requirePathId(request, "id", "user")));
  };
  create = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    apiResponse.post(response, await this.service.create(requireBearerToken(request), createUserSchema.parse(request.body)));
  };
  update = async (request: Request, response: Response): Promise<void> => {
    requireJson(request);
    apiResponse.patch(response, await this.service.update(
      requireBearerToken(request), requirePathId(request, "id", "user"), updateUserSchema.parse(request.body),
    ));
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(requireBearerToken(request), requirePathId(request, "id", "user"));
    apiResponse.delete(response);
  };

  private setRefreshCookie(request: Request, response: Response, result: IssuedUserSession): void {
    response.setHeader("set-cookie", serializeHttpOnlyCookie(this.refreshCookieName, result.refreshToken, {
      secure: request.secure,
      path: "/api/admin/auth",
      maxAgeSeconds: this.refreshTtlDays * 86_400,
      expires: result.refreshTokenExpiresAt,
    }));
  }
  private publicSession({ refreshToken: _token, refreshTokenExpiresAt: _expiry, ...session }: IssuedUserSession) {
    return session;
  }
}
