import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { getMessages, toDayjsLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

export const MANTINE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function toMantineDateTimeValue(date: Date | string): string {
  return dayjs(date).format(MANTINE_DATETIME_FORMAT);
}

export function mantineValueToIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.toDate().toISOString();
}

export function formatConsultationRange(
  startsAt: string,
  endsAt: string,
  locale: Locale = 'en',
): string {
  const dayjsLocale = toDayjsLocale(locale);
  const start = dayjs(startsAt).locale(dayjsLocale);
  const end = dayjs(endsAt).locale(dayjsLocale);
  if (!start.isValid() || !end.isValid()) {
    return getMessages(locale).date.invalidSchedule;
  }

  if (locale === 'zh-CN') {
    if (start.isSame(end, 'day')) {
      return `${start.format('YYYY年M月D日 ddd · HH:mm')} – ${end.format('HH:mm')}`;
    }
    return `${start.format('YYYY年M月D日 HH:mm')} – ${end.format('YYYY年M月D日 HH:mm')}`;
  }

  if (start.isSame(end, 'day')) {
    return `${start.format('ddd, DD MMM YYYY · HH:mm')} – ${end.format('HH:mm')}`;
  }
  return `${start.format('DD MMM YYYY HH:mm')} – ${end.format('DD MMM YYYY HH:mm')}`;
}

export function getDefaultBookingRange(): { startsAt: string; endsAt: string } {
  const tomorrow = dayjs().add(1, 'day').hour(10).minute(0).second(0).millisecond(0);
  return {
    startsAt: tomorrow.format(MANTINE_DATETIME_FORMAT),
    endsAt: tomorrow.add(1, 'hour').format(MANTINE_DATETIME_FORMAT),
  };
}
