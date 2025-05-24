import { ProcessedRequest, filterForwardedHeaders } from './request.js';

export interface HttpResponse {
  data: unknown;
  headers: Record<string, string>;
  status: number;
}

/**
 * Enhanced HTTP Error class for better error categorization
 */
export class HttpClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public type: 'timeout' | 'network' | 'response' | 'unknown' = 'unknown'
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

/**
 * Prepare request body based on content type with error handling
 */
function prepareRequestBody(
  body: unknown,
  originalContentType?: string,
  headers: Record<string, string> = {}
): { body?: BodyInit; headers: Record<string, string> } {
  if (!body) {
    return { headers };
  }

  const updatedHeaders = { ...headers };

  try {
    if (typeof body === 'string') {
      return { body, headers: updatedHeaders };
    }

    if (body instanceof Buffer) {
      return { body, headers: updatedHeaders };
    }

    if (originalContentType?.includes('application/x-www-form-urlencoded')) {
      // Handle form data - convert object back to form-encoded string
      try {
        const formData = new URLSearchParams();
        Object.entries(body as Record<string, string>).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
        updatedHeaders['content-type'] = 'application/x-www-form-urlencoded';
        return { body: formData.toString(), headers: updatedHeaders };
      } catch (error) {
        throw new HttpClientError(
          'Failed to prepare form-encoded body',
          'BODY_PREPARATION_ERROR',
          400,
          'response'
        );
      }
    }

    // Default to JSON for other object types
    try {
      updatedHeaders['content-type'] = updatedHeaders['content-type'] || 'application/json';
      return { body: JSON.stringify(body), headers: updatedHeaders };
    } catch (error) {
      throw new HttpClientError(
        'Failed to serialize request body to JSON',
        'JSON_SERIALIZATION_ERROR',
        400,
        'response'
      );
    }
  } catch (error) {
    if (error instanceof HttpClientError) {
      throw error;
    }
    throw new HttpClientError(
      'Failed to prepare request body',
      'BODY_PREPARATION_ERROR',
      400,
      'response'
    );
  }
}

/**
 * Parse response body based on content type with comprehensive error handling
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        throw new HttpClientError(
          'Failed to parse JSON response',
          'JSON_PARSE_ERROR',
          response.status,
          'response'
        );
      }
    }

    if (contentType?.includes('text/')) {
      try {
        return await response.text();
      } catch (error) {
        throw new HttpClientError(
          'Failed to parse text response',
          'TEXT_PARSE_ERROR',
          response.status,
          'response'
        );
      }
    }

    // For binary data or unknown content types
    try {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      throw new HttpClientError(
        'Failed to parse binary response',
        'BINARY_PARSE_ERROR',
        response.status,
        'response'
      );
    }
  } catch (error) {
    if (error instanceof HttpClientError) {
      throw error;
    }
    throw new HttpClientError(
      'Failed to parse response body',
      'RESPONSE_PARSE_ERROR',
      response.status,
      'response'
    );
  }
}

/**
 * Filter response headers that should be passed through
 */
function filterResponseHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};

  try {
    headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      const lowerKey = key.toLowerCase();
      if (
        !lowerKey.startsWith('transfer-') &&
        lowerKey !== 'connection' &&
        lowerKey !== 'keep-alive' &&
        lowerKey !== 'upgrade' &&
        lowerKey !== 'proxy-authenticate' &&
        lowerKey !== 'proxy-authorization' &&
        lowerKey !== 'te' &&
        lowerKey !== 'trailers'
      ) {
        filtered[key] = value;
      }
    });
  } catch (error) {
    // If header filtering fails, return empty headers
    console.warn('Failed to filter response headers:', error);
  }

  return filtered;
}

/**
 * Forward request to target server with comprehensive error handling and return processed response
 */
export async function forwardRequest(request: ProcessedRequest): Promise<HttpResponse> {
  const { method, targetUrl, headers, body, originalContentType } = request;

  try {
    // Filter headers that shouldn't be forwarded
    let filteredHeaders: Record<string, string>;
    try {
      filteredHeaders = filterForwardedHeaders(headers);
    } catch (error) {
      console.warn('Failed to filter headers, using original headers:', error);
      filteredHeaders = headers;
    }

    // Prepare fetch options with error handling
    const fetchOptions: RequestInit = {
      method,
      headers: filteredHeaders,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };

    // Add body for methods that support it
    if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
      try {
        const { body: preparedBody, headers: updatedHeaders } = prepareRequestBody(
          body,
          originalContentType,
          filteredHeaders
        );
        fetchOptions.body = preparedBody;
        fetchOptions.headers = updatedHeaders;
      } catch (error) {
        if (error instanceof HttpClientError) {
          throw error;
        }
        throw new HttpClientError(
          'Failed to prepare request body',
          'BODY_PREPARATION_ERROR',
          400,
          'response'
        );
      }
    }

    // Forward the request to the target server with comprehensive error handling
    let response: Response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } catch (error: any) {
      // Categorize fetch errors
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new HttpClientError(
          'Request timeout - target server took too long to respond',
          'ETIMEDOUT',
          504,
          'timeout'
        );
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new HttpClientError(
          'Network error - unable to reach target server',
          'ECONNREFUSED',
          502,
          'network'
        );
      }

      // Handle other network errors
      const errorCode = error.code || 'UNKNOWN_NETWORK_ERROR';
      const errorMessage = error.message || 'Unknown network error occurred';

      throw new HttpClientError(
        `Network request failed: ${errorMessage}`,
        errorCode,
        502,
        'network'
      );
    }

    // Process response with error handling
    let responseHeaders: Record<string, string>;
    try {
      responseHeaders = filterResponseHeaders(response.headers);
    } catch (error) {
      console.warn('Failed to process response headers:', error);
      responseHeaders = {};
    }

    let responseData: unknown;
    try {
      responseData = await parseResponseBody(response);
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw error;
      }
      throw new HttpClientError(
        'Failed to parse response from target server',
        'RESPONSE_PARSE_ERROR',
        response.status,
        'response'
      );
    }

    return {
      data: responseData,
      headers: responseHeaders,
      status: response.status,
    };
  } catch (error) {
    // Re-throw HttpClientError instances
    if (error instanceof HttpClientError) {
      throw error;
    }

    // Handle unexpected errors
    throw new HttpClientError(
      `Unexpected error during request forwarding: ${error instanceof Error ? error.message : String(error)}`,
      'UNEXPECTED_ERROR',
      500,
      'unknown'
    );
  }
}
