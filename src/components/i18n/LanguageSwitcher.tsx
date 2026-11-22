'use client';

import { Group, SegmentedControl, VisuallyHidden } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useI18n } from '@/components/providers/I18nProvider';
import { localeSchema } from '@/lib/contracts';

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
        onChange={(val) => {
          const parsed = localeSchema.safeParse(val);
          if (parsed.success) {
            setVisitorLocale(parsed.data);
          }
        }}
        data={[
          { label: messages.common.englishOption, value: 'en' },
          { label: messages.common.simplifiedChineseOption, value: 'zh-CN' },
        ]}
        data-testid="visitor-language-switcher"
      />
    </Group>
  );
}
