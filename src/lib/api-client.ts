import { z } from 'zod';
import { apiErrorBodySchema } from './contracts';

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions<TResponse, TRequest = unknown>
  extends Omit<RequestInit, 'body'> {
  responseSchema: z.ZodType<TResponse>;
  requestSchema?: z.ZodType<unknown, z.ZodTypeDef, TRequest>;
  body?: TRequest;
}

export async function apiRequest<TResponse, TRequest = unknown>(
  url: string,
  options: ApiRequestOptions<TResponse, TRequest>,
): Promise<TResponse> {
  const { responseSchema, requestSchema, body, ...fetchOptions } = options;

  let serializedBody: string | undefined;
  if (body !== undefined) {
    let payload: unknown = body;
    if (requestSchema) {
      const validated = requestSchema.safeParse(body);
      if (!validated.success) {
        const firstIssue = validated.error.issues[0];
        throw new ClientApiError(
          400,
          'VALIDATION_ERROR',
          firstIssue?.message || 'Request validation failed.',
          validated.error.flatten(),
        );
      }
      payload = validated.data;
    }
    serializedBody = JSON.stringify(payload);
  }

  const headers = new Headers(fetchOptions.headers);
  if (serializedBody !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...fetchOptions,
    body: serializedBody,
    headers,
    credentials: 'same-origin',
  });

  const text = await response.text();
  let parsedJson: unknown = null;
  if (text) {
    try {
      parsedJson = JSON.parse(text);
    } catch {
      parsedJson = null;
    }
  }

  if (!response.ok) {
    const errParsed = apiErrorBodySchema.safeParse(parsedJson);
    if (errParsed.success) {
      throw new ClientApiError(
        response.status,
        errParsed.data.error.code,
        errParsed.data.error.message,
        errParsed.data.error.details,
      );
    }

    throw new ClientApiError(
      response.status,
      'REQUEST_FAILED',
      `Request failed with status ${response.status}.`,
    );
  }

  const validatedResponse = responseSchema.safeParse(parsedJson);
  if (!validatedResponse.success) {
    throw new ClientApiError(
      500,
      'INVALID_API_RESPONSE',
      'Received unexpected response shape from server.',
      validatedResponse.error.flatten(),
    );
  }

  return validatedResponse.data;
}
