'use client';

import { Group, SegmentedControl, VisuallyHidden } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useI18n } from '@/components/providers/I18nProvider';
import type { Locale } from '@/lib/types';

export function LanguageSwitcher() {
  const { locale, messages, setVisitorLocale } = useI18n();

  return (
    <Group gap="xs" align="center" wrap="nowrap">
      <IconLanguage size={16} aria-hidden="true" />
      <VisuallyHidden>{messages.common.languageLabel}</VisuallyHidden>
      <SegmentedControl
        size="xs"
        aria-label={messages.common.languageLabel}
        value={locale}
        onChange={(val) => setVisitorLocale(val as Locale)}
        data={[
          { label: messages.common.englishOption, value: 'en' },
          { label: messages.common.simplifiedChineseOption, value: 'zh-CN' },
        ]}
        data-testid="visitor-language-switcher"
      />
    </Group>
  );
}
