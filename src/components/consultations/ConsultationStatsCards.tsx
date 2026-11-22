'use client';

import { Card, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import {
  IconBan,
  IconCalendarClock,
  IconCalendarStats,
  IconCircleCheck,
} from '@tabler/icons-react';
import { useI18n } from '@/components/providers/I18nProvider';
import type { ConsultationStats } from '@/lib/types';

interface ConsultationStatsCardsProps {
  stats: ConsultationStats;
}

export function ConsultationStatsCards({ stats }: ConsultationStatsCardsProps) {
  const { messages } = useI18n();

  const items = [
    {
      key: 'total',
      label: messages.dashboard.stats.total,
      value: stats.total,
      color: 'indigo',
      icon: <IconCalendarStats size={18} />,
    },
    {
      key: 'scheduled',
      label: messages.dashboard.stats.scheduled,
      value: stats.scheduled,
      color: 'blue',
      icon: <IconCalendarClock size={18} />,
    },
    {
      key: 'completed',
      label: messages.dashboard.stats.completed,
      value: stats.completed,
      color: 'teal',
      icon: <IconCircleCheck size={18} />,
    },
    {
      key: 'cancelled',
      label: messages.dashboard.stats.cancelled,
      value: stats.cancelled,
      color: 'gray',
      icon: <IconBan size={18} />,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      {items.map((item) => (
        <Card key={item.key} padding="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                {item.label}
              </Text>
              <Text size="xl" fw={700} mt={4} data-testid={`stat-${item.key}`}>
                {item.value}
              </Text>
            </div>
            <ThemeIcon variant="light" color={item.color} size="lg" radius="md">
              {item.icon}
            </ThemeIcon>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
