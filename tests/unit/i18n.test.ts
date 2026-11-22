import { describe, expect, test } from 'bun:test';
import {
  detectLocaleFromAcceptLanguage,
  formatMessage,
  getMessages,
  normalizeLocale,
  resolveInitialLocale,
  toDayjsLocale,
} from '@/lib/i18n';
import { updateUserSettingsSchema } from '@/lib/validation';

function collectLeafKeys(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...collectLeafKeys(val as Record<string, unknown>, nextPath));
    } else {
      result.push({ path: nextPath, value: val });
    }
  }
  return result;
}

describe('i18n Detection, Dictionaries & Validation', () => {
  test('normalizeLocale maps English and Simplified Chinese variants accurately', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en_AU')).toBe('en');
    expect(normalizeLocale('zh')).toBe('zh-CN');
    expect(normalizeLocale('zh-CN')).toBe('zh-CN');
    expect(normalizeLocale('zh_CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-SG')).toBe('zh-CN');
    expect(normalizeLocale('fr-FR')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
  });

  test('detectLocaleFromAcceptLanguage respects quality weights and falls back to en', () => {
    expect(detectLocaleFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-CN');
    expect(detectLocaleFromAcceptLanguage('fr-CH, fr;q=0.9, zh-Hans;q=0.8, en;q=0.7')).toBe('zh-CN');
    expect(detectLocaleFromAcceptLanguage('en-GB;q=0.9, zh-CN;q=0.5')).toBe('en');
    expect(detectLocaleFromAcceptLanguage('ja,de;q=0.8')).toBe('en');
    expect(detectLocaleFromAcceptLanguage(null)).toBe('en');
  });

  test('resolveInitialLocale follows user > cookie > Accept-Language > en precedence', () => {
    expect(
      resolveInitialLocale({
        userLocale: 'en',
        cookieLocale: 'zh-CN',
        acceptLanguage: 'zh-CN',
      }),
    ).toBe('en');

    expect(
      resolveInitialLocale({
        userLocale: null,
        cookieLocale: 'zh-CN',
        acceptLanguage: 'en-US',
      }),
    ).toBe('zh-CN');

    expect(
      resolveInitialLocale({
        userLocale: null,
        cookieLocale: null,
        acceptLanguage: 'zh-CN,zh;q=0.9',
      }),
    ).toBe('zh-CN');

    expect(resolveInitialLocale({})).toBe('en');
  });

  test('toDayjsLocale maps supported locales cleanly', () => {
    expect(toDayjsLocale('en')).toBe('en');
    expect(toDayjsLocale('zh-CN')).toBe('zh-cn');
  });

  test('formatMessage interpolates template placeholders', () => {
    expect(formatMessage('Showing {shown} of {total}', { shown: 3, total: 10 })).toBe(
      'Showing 3 of 10',
    );
  });

  test('en and zh-CN dictionaries have identical leaf keys and non-empty translations', () => {
    const enLeaves = collectLeafKeys(getMessages('en') as unknown as Record<string, unknown>);
    const zhLeaves = collectLeafKeys(getMessages('zh-CN') as unknown as Record<string, unknown>);

    const enPaths = enLeaves.map((e) => e.path).sort();
    const zhPaths = zhLeaves.map((z) => z.path).sort();

    expect(zhPaths).toEqual(enPaths);

    for (const leaf of enLeaves) {
      expect(typeof leaf.value).toBe('string');
      expect((leaf.value as string).trim().length).toBeGreaterThan(0);
    }
    for (const leaf of zhLeaves) {
      expect(typeof leaf.value).toBe('string');
      expect((leaf.value as string).trim().length).toBeGreaterThan(0);
    }
  });

  test('updateUserSettingsSchema accepts en and zh-CN and rejects unsupported locales', () => {
    expect(updateUserSettingsSchema.parse({ preferredLocale: 'zh-CN' })).toEqual({
      preferredLocale: 'zh-CN',
    });
    expect(updateUserSettingsSchema.parse({ preferredLocale: 'en' })).toEqual({
      preferredLocale: 'en',
    });
    expect(() =>
      updateUserSettingsSchema.parse({ preferredLocale: 'fr' }),
    ).toThrow();
  });
});
