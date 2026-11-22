import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { LOCALE_COOKIE_NAME, resolveInitialLocale } from '@/lib/i18n';
import { theme } from '@/theme';

export const metadata: Metadata = {
  title: 'Contour Mini LMS — Consultations & Attribute-Based Access Control',
  description:
    'Consultation booking portal and attribute-composed RBAC administration built with Next.js 16, Supabase, and Mantine.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const initialLocale = resolveInitialLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });

  return (
    <html lang={initialLocale} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" />
          <AuthProvider>
            <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
