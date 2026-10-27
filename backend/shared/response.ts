import type { Response } from 'express';
import { HttpStatus } from './status';

type Headers = Record<string, string>;

function send(response: Response, status: number, body?: unknown, headers: Headers = {}): Response {
  response.set(headers);
  if (body === undefined) return response.sendStatus(status);
  return response.status(status).json(body);
}

export const apiResponse = {
  get: (response: Response, body: unknown, headers?: Headers) =>
    send(response, HttpStatus.OK, body, headers),
  post: (response: Response, body: unknown, headers?: Headers) =>
    send(response, HttpStatus.CREATED, body, headers),
  put: (response: Response, body: unknown, headers?: Headers) =>
    send(response, HttpStatus.OK, body, headers),
  delete: (response: Response, body?: unknown, headers?: Headers) =>
    send(response, body === undefined ? HttpStatus.NO_CONTENT : HttpStatus.OK, body, headers),
  patch: (response: Response, body: unknown, headers?: Headers) =>
    send(response, HttpStatus.OK, body, headers),
  options: (response: Response, headers?: Headers) =>
    send(response, HttpStatus.NO_CONTENT, undefined, headers),
} as const;
