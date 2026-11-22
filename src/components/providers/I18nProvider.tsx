'use client';

import 'dayjs/locale/zh-cn';
import { DatesProvider } from '@mantine/dates';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  getMessages,
  LOCALE_COOKIE_NAME,
  toDayjsLocale,
  type TranslationDictionary,
} from '@/lib/i18n';
import type { Locale } from '@/lib/types';

interface I18nContextValue {
  locale: Locale;
  messages: TranslationDictionary;
  setVisitorLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const { auth } = useAuth();
  const [visitorLocale, setVisitorLocaleState] = useState<Locale | null>(null);

  const locale: Locale =
    auth?.user.preferredLocale ?? visitorLocale ?? initialLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setVisitorLocale = useCallback((next: Locale) => {
    setVisitorLocaleState(next);
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages: getMessages(locale),
      setVisitorLocale,
    }),
    [locale, setVisitorLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      <DatesProvider
        settings={{ locale: toDayjsLocale(locale), firstDayOfWeek: 1 }}
      >
        {children}
      </DatesProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>.');
  }
  return ctx;
}
