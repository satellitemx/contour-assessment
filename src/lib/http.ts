import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { apiErrorBodySchema } from './contracts';
import type { ApiErrorBody } from './types';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonOk<TSchema extends z.ZodTypeAny>(
  data: z.input<TSchema>,
  schema: TSchema,
  status = 200,
): NextResponse<z.output<TSchema>> {
  const validated = schema.parse(data);
  return NextResponse.json(validated, { status });
}

export function jsonCreated<TSchema extends z.ZodTypeAny>(
  data: z.input<TSchema>,
  schema: TSchema,
): NextResponse<z.output<TSchema>> {
  return jsonOk(data, schema, 201);
}

export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const body = apiErrorBodySchema.parse({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstIssue?.message || 'Validation failed.',
        details: error.flatten(),
      },
    });
    return NextResponse.json(body, { status: 400 });
  }

  if (error instanceof AppError) {
    const body = apiErrorBodySchema.parse({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return NextResponse.json(body, { status: error.status });
  }

  console.error('[API Error]', error);
  const body = apiErrorBodySchema.parse({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
  return NextResponse.json(body, { status: 500 });
}

export const safeRedirectPathSchema = z
  .string()
  .trim()
  .refine(
    (path) => path.startsWith('/') && !path.startsWith('//') && !path.includes('\\'),
    'Redirect path must be a safe relative path.',
  );

export function sanitizeRedirectPath(
  rawPath: string | null | undefined,
  fallback = '/',
): string {
  const parsed = safeRedirectPathSchema.safeParse(rawPath);
  return parsed.success ? parsed.data : fallback;
}

export function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === 'true' && process.env.VERCEL !== '1';
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}
