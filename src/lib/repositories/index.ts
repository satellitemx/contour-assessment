import { cookies } from 'next/headers';
import os from 'node:os';
import path from 'node:path';
import { isE2ETestMode } from '@/lib/http';
import {
  E2E_SESSION_COOKIE_NAME,
  MemoryRepository,
  type SessionAdapter,
} from './memory-repository';
import { SupabaseRepository } from './supabase-repository';
import type { LmsRepository } from './types';

class NextCookiesSessionAdapter implements SessionAdapter {
  async getSessionToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(E2E_SESSION_COOKIE_NAME)?.value ?? null;
  }

  async setSessionToken(token: string | null): Promise<void> {
    try {
      const cookieStore = await cookies();
      if (token) {
        cookieStore.set(E2E_SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
        });
      } else {
        cookieStore.delete(E2E_SESSION_COOKIE_NAME);
      }
    } catch {
      // Ignored in read-only Server Component context
    }
  }
}

let testRepositoryOverride: LmsRepository | null = null;
let cachedE2ERepository: MemoryRepository | null = null;

export function getE2EStoreFilePath(): string {
  return (
    process.env.E2E_STORE_FILE ||
    path.join(os.tmpdir(), 'contour-lms-e2e-store.json')
  );
}

export function getE2ERepository(): MemoryRepository {
  if (!cachedE2ERepository) {
    cachedE2ERepository = new MemoryRepository({
      persistenceFile: getE2EStoreFilePath(),
      sessionAdapter: new NextCookiesSessionAdapter(),
    });
  }
  return cachedE2ERepository;
}

export function setTestRepository(repo: LmsRepository | null): void {
  testRepositoryOverride = repo;
}

export function getLmsRepository(): LmsRepository {
  if (testRepositoryOverride) {
    return testRepositoryOverride;
  }
  if (isE2ETestMode()) {
    return getE2ERepository();
  }
  return new SupabaseRepository();
}
