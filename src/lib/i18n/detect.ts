import type { Locale } from '@/lib/types';
import { DEFAULT_LOCALE } from './types';

export function normalizeLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/_/g, '-');
  if (!cleaned) return null;
  if (cleaned === 'en' || cleaned.startsWith('en-')) return 'en';
  if (
    cleaned === 'zh' ||
    cleaned === 'zh-cn' ||
    cleaned === 'zh-hans' ||
    cleaned.startsWith('zh-hans-') ||
    cleaned === 'zh-sg' ||
    cleaned.startsWith('zh-')
  ) {
    return 'zh-CN';
  }
  return null;
}

export function detectLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(',')
    .map((part, index) => {
      const [tagPart, ...params] = part.split(';').map((s) => s.trim());
      let q = 1;
      for (const param of params) {
        if (param.startsWith('q=')) {
          const parsed = Number.parseFloat(param.slice(2));
          if (!Number.isNaN(parsed)) {
            q = parsed;
          }
        }
      }
      return { tag: tagPart, q, index };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => (b.q !== a.q ? b.q - a.q : a.index - b.index));

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate.tag);
    if (normalized) return normalized;
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(params: {
  userLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const fromUser = normalizeLocale(params.userLocale);
  if (fromUser) return fromUser;

  const fromCookie = normalizeLocale(params.cookieLocale);
  if (fromCookie) return fromCookie;

  return detectLocaleFromAcceptLanguage(params.acceptLanguage);
}

export function toDayjsLocale(locale: Locale): 'en' | 'zh-cn' {
  return locale === 'zh-CN' ? 'zh-cn' : 'en';
}
