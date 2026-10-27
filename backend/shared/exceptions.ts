import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpStatus } from './status';

export class ApiException extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestException extends ApiException {
  constructor(message = 'Invalid request', details?: unknown) {
    super(HttpStatus.BAD_REQUEST, message, details);
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message = 'Authentication required') {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}

export class ConflictException extends ApiException {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(HttpStatus.CONFLICT, message, details);
  }
}

export class TooManyRequestsException extends ApiException {
  constructor(message = 'Request is already being processed', details?: unknown) {
    super(HttpStatus.TOO_MANY_REQUESTS, message, details);
  }
}

export class BadGatewayException extends ApiException {
  constructor(message = 'Payment provider request failed', details?: unknown) {
    super(HttpStatus.BAD_GATEWAY, message, details);
  }
}

export class ForbiddenException extends ApiException {
  constructor(message = 'Origin not allowed') {
    super(HttpStatus.FORBIDDEN, message);
  }
}

export class NotFoundException extends ApiException {
  constructor(message = 'Not found') {
    super(HttpStatus.NOT_FOUND, message);
  }
}

export class UnsupportedMediaTypeException extends ApiException {
  constructor(message = 'Content-Type must be application/json') {
    super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, message);
  }
}

export class ServiceUnavailableException extends ApiException {
  constructor(message = 'Service unavailable', details?: unknown) {
    super(HttpStatus.SERVICE_UNAVAILABLE, message, details);
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new NotFoundException());
};

export const exceptionHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    response.status(HttpStatus.BAD_REQUEST).json({
      error: 'Invalid request',
      details: error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }

  if (error instanceof ApiException) {
    response
      .status(error.status)
      .json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(HttpStatus.BAD_REQUEST).json({ error: 'Request body must be valid JSON' });
    return;
  }

  if (error instanceof Error && error.message.includes('DATABASE_URL is required')) {
    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      error: 'Service unavailable',
      details: 'Database is not configured',
    });
    return;
  }

  console.error('API request failed', error instanceof Error ? error.message : 'Unknown error');
  response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
};
