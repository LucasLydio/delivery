import type { Request } from 'express';
import {
  BadRequestException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '../shared/exceptions';

export function requireJson(request: Request): void {
  if (!request.is('application/json')) throw new UnsupportedMediaTypeException();
}

export function requireBearerToken(request: Request): string {
  const authorization = request.header('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new UnauthorizedException('Bearer access token required');
  return match[1];
}

export function requirePathId(request: Request, parameter: string, label = 'resource'): string {
  const value = request.params[parameter];
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new BadRequestException(`Invalid ${label} ID`);
  }
  return value;
}
