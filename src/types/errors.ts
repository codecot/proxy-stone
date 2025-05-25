export class ProxyError extends Error {
  code: string;
  statusCode: number;
  context?: any;

  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

export class CacheError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'CacheError';
  }
}

export class BackendError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'BackendError';
  }
}

export class ValidationError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends ProxyError {
  constructor(message: string, code: string, statusCode: number, context?: any) {
    super(message, code, statusCode, context);
    this.name = 'DatabaseError';
  }
}

export function isProxyError(error: any): error is ProxyError {
  return error instanceof ProxyError;
}

export function createErrorResponse(error: Error) {
  if (isProxyError(error)) {
    return {
      error: error.name,
      code: error.code,
      message: error.message,
      context: error.context,
    };
  }

  return {
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message: error.message,
  };
}
