import type { Locale } from '@/lib/types';
import { enMessages } from './messages/en';
import { zhCNMessages } from './messages/zh-CN';
import type { TranslationDictionary } from './types';

export * from './detect';
export * from './types';

const DICTIONARIES: Record<Locale, TranslationDictionary> = {
  en: enMessages,
  'zh-CN': zhCNMessages,
};

export function getMessages(locale: Locale): TranslationDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}

export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
