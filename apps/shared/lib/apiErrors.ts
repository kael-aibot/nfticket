import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export const API_ERROR_CODES = {
  internal: 'INTERNAL_ERROR',
  badRequest: 'BAD_REQUEST',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  conflict: 'CONFLICT',
  gone: 'GONE',
  methodNotAllowed: 'METHOD_NOT_ALLOWED',
  serviceUnavailable: 'SERVICE_UNAVAILABLE',
  invalidSignature: 'INVALID_SIGNATURE',
  invalidSession: 'INVALID_SESSION',
  sessionExpired: 'SESSION_EXPIRED',
  authRequired: 'AUTH_REQUIRED',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface RequestContextRequest extends NextApiRequest {
  requestId?: string;
}

export type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void> | void;

/**
 * Wraps API handlers with Sentry error capture and structured logging
 */
export function withApiErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();
    const requestId = `req_${randomUUID()}`;
    (req as RequestContextRequest).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Add request context to Sentry
    Sentry.setContext('http_request', {
      url: req.url,
      method: req.method,
      query: req.query,
      requestId,
    });

    Sentry.setTag('api_endpoint', req.url?.split('?')[0] || 'unknown');
    Sentry.setTag('http_method', req.method || 'unknown');
    Sentry.setTag('request_id', requestId);

    try {
      await handler(req, res);

      // Log successful request
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = normalizeApiError(error);

      // Capture with Sentry
      Sentry.captureException(error, {
        level: 'error',
        contexts: {
          request: {
            url: req.url,
            method: req.method,
            requestId,
          },
        },
        tags: {
          error_type: apiError.name,
          error_code: apiError.code,
          api_endpoint: req.url?.split('?')[0] || 'unknown',
        },
      });

      // Log error
      console.error(`[${requestId}] ${req.method} ${req.url} - ERROR (${duration}ms):`, error);

      // Send structured error response
      if (!res.headersSent) {
        const message = apiError.expose || process.env.NODE_ENV !== 'production'
          ? apiError.message
          : 'An unexpected error occurred';

        res.status(apiError.statusCode).json({
          error: message,
          message,
          success: false,
          requestId,
          code: apiError.code,
        });
      }
    }
  };
}

/**
 * Structured API error with status code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = API_ERROR_CODES.internal,
    public expose: boolean = statusCode < 500
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, code: string = API_ERROR_CODES.badRequest) {
    return new ApiError(message, 400, code);
  }

  static unauthorized(message = 'Unauthorized', code: string = API_ERROR_CODES.unauthorized) {
    return new ApiError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code: string = API_ERROR_CODES.forbidden) {
    return new ApiError(message, 403, code);
  }

  static notFound(message: string, code: string = API_ERROR_CODES.notFound) {
    return new ApiError(message, 404, code);
  }

  static conflict(message: string, code: string = API_ERROR_CODES.conflict) {
    return new ApiError(message, 409, code);
  }

  static gone(message: string, code: string = API_ERROR_CODES.gone) {
    return new ApiError(message, 410, code);
  }

  static methodNotAllowed(message = 'Method not allowed', code: string = API_ERROR_CODES.methodNotAllowed) {
    return new ApiError(message, 405, code);
  }

  static serviceUnavailable(message: string, code: string = API_ERROR_CODES.serviceUnavailable) {
    return new ApiError(message, 503, code);
  }

  static internal(message = 'Internal server error', code: string = API_ERROR_CODES.internal) {
    return new ApiError(message, 500, code, false);
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return ApiError.internal(error.message);
  }

  return ApiError.internal('Unknown error');
}
