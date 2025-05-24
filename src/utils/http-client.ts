import { ProcessedRequest, filterForwardedHeaders } from './request.js';

export interface HttpResponse {
  data: unknown;
  headers: Record<string, string>;
  status: number;
}

/**
 * Prepare request body based on content type
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

  if (typeof body === 'string') {
    return { body, headers: updatedHeaders };
  }

  if (body instanceof Buffer) {
    return { body, headers: updatedHeaders };
  }

  if (originalContentType?.includes('application/x-www-form-urlencoded')) {
    // Handle form data - convert object back to form-encoded string
    const formData = new URLSearchParams();
    Object.entries(body as Record<string, string>).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    updatedHeaders['content-type'] = 'application/x-www-form-urlencoded';
    return { body: formData.toString(), headers: updatedHeaders };
  }

  // Default to JSON for other object types
  updatedHeaders['content-type'] = updatedHeaders['content-type'] || 'application/json';
  return { body: JSON.stringify(body), headers: updatedHeaders };
}

/**
 * Parse response body based on content type
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return await response.json();
  }

  if (contentType?.includes('text/')) {
    return await response.text();
  }

  // For binary data or unknown content types
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

/**
 * Filter response headers that shouldn't be forwarded
 */
function filterResponseHeaders(headers: Headers): Record<string, string> {
  const responseHeaders = Object.fromEntries(headers.entries());
  delete responseHeaders['content-encoding'];
  delete responseHeaders['transfer-encoding'];
  return responseHeaders;
}

/**
 * Forward request to target server and return processed response
 */
export async function forwardRequest(request: ProcessedRequest): Promise<HttpResponse> {
  const { method, targetUrl, headers, body, originalContentType } = request;

  // Filter headers that shouldn't be forwarded
  const filteredHeaders = filterForwardedHeaders(headers);

  // Prepare fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: filteredHeaders,
  };

  // Add body for methods that support it
  if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
    const { body: preparedBody, headers: updatedHeaders } = prepareRequestBody(
      body,
      originalContentType,
      filteredHeaders
    );
    fetchOptions.body = preparedBody;
    fetchOptions.headers = updatedHeaders;
  }

  // Forward the request to the target server
  const response = await fetch(targetUrl, fetchOptions);

  // Process response
  const responseHeaders = filterResponseHeaders(response.headers);
  const responseData = await parseResponseBody(response);

  return {
    data: responseData,
    headers: responseHeaders,
    status: response.status,
  };
}
