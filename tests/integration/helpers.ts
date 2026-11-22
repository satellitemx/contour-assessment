import {
  InMemorySessionAdapter,
  MemoryRepository,
} from '@/lib/repositories/memory-repository';

export function createTestRepo() {
  const sessionAdapter = new InMemorySessionAdapter();
  const repo = new MemoryRepository({ sessionAdapter });
  return { repo, sessionAdapter };
}

export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
