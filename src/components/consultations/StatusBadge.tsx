'use client';

import { Badge } from '@mantine/core';
import { useI18n } from '@/components/providers/I18nProvider';
import type { ConsultationStatus } from '@/lib/types';

const STATUS_COLOR: Record<ConsultationStatus, string> = {
  scheduled: 'blue',
  completed: 'teal',
  cancelled: 'gray',
};

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  const { messages } = useI18n();
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" radius="sm">
      {messages.consultationStatus[status]}
    </Badge>
  );
}
