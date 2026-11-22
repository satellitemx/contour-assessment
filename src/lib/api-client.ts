import type { ApiErrorBody } from './types';

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

export async function apiRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errBody = parsed as Partial<ApiErrorBody> | null;
    throw new ClientApiError(
      response.status,
      errBody?.error?.code || 'REQUEST_FAILED',
      errBody?.error?.message || `Request failed with status ${response.status}.`,
      errBody?.error?.details,
    );
  }

  return parsed as T;
}
