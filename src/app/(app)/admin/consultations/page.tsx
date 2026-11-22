'use client';

import {
  Alert,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Pagination,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertCircle, IconEye, IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { ConsultationStatsCards } from '@/components/consultations/ConsultationStatsCards';
import { formatConsultationRange } from '@/components/consultations/date-utils';
import { StatusBadge } from '@/components/consultations/StatusBadge';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import {
  adminConsultationsResponseSchema,
  consultationStatusFilterSchema,
} from '@/lib/contracts';
import { formatMessage } from '@/lib/i18n';
import { PERMISSIONS } from '@/lib/permissions';
import type {
  AdminConsultation,
  ConsultationStats,
  ConsultationStatusFilter,
} from '@/lib/types';

const EMPTY_STATS: ConsultationStats = {
  total: 0,
  scheduled: 0,
  completed: 0,
  cancelled: 0,
};

function AdminConsultationsContent() {
  const { locale, messages } = useI18n();
  const [consultations, setConsultations] = useState<AdminConsultation[]>([]);
  const [stats, setStats] = useState<ConsultationStats>(EMPTY_STATS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] =
    useState<ConsultationStatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchText, 200);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set('status', statusFilter);
        params.set('page', String(page));
        params.set('pageSize', '20');
        if (debouncedSearch.trim()) {
          params.set('search', debouncedSearch.trim());
        }

        const res = await apiRequest(
          `/api/admin/consultations?${params.toString()}`,
          {
            cache: 'no-store',
            responseSchema: adminConsultationsResponseSchema,
          },
        );

        if (!active) return;
        setConsultations(res.consultations);
        setStats(res.stats);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.totalItems);
        setErrorMsg(null);
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof ClientApiError
            ? err.message
            : messages.adminConsultations.loadError,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [statusFilter, page, debouncedSearch, messages.adminConsultations.loadError]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>{messages.adminConsultations.title}</Title>
            <Badge
              variant="light"
              color="gray"
              leftSection={<IconEye size={13} />}
            >
              {messages.adminConsultations.readOnlyBadge}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {messages.adminConsultations.subtitle}
          </Text>
        </div>
        <Text size="xs" c="dimmed">
          {formatMessage(messages.adminConsultations.showingCount, {
            shown: consultations.length,
            total: totalItems,
          })}
        </Text>
      </Group>

      <ConsultationStatsCards stats={stats} />

      <Paper withBorder p="md">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <SegmentedControl
              value={statusFilter}
              onChange={(val) => {
                const parsed = consultationStatusFilterSchema.safeParse(val);
                if (parsed.success) {
                  setStatusFilter(parsed.data);
                  setPage(1);
                }
              }}
              data={[
                { label: messages.consultationStatus.all, value: 'all' },
                {
                  label: messages.consultationStatus.scheduled,
                  value: 'scheduled',
                },
                {
                  label: messages.consultationStatus.completed,
                  value: 'completed',
                },
                {
                  label: messages.consultationStatus.cancelled,
                  value: 'cancelled',
                },
              ]}
            />

            <TextInput
              placeholder={messages.adminConsultations.searchPlaceholder}
              leftSection={<IconSearch size={16} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.currentTarget.value);
                setPage(1);
              }}
              w={{ base: '100%', sm: 320 }}
              aria-label={messages.adminConsultations.searchAriaLabel}
            />
          </Group>

          {errorMsg && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
              {errorMsg}
            </Alert>
          )}

          {loading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : consultations.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <Text fw={600}>{messages.adminConsultations.emptyTitle}</Text>
                <Text size="sm" c="dimmed">
                  {messages.adminConsultations.emptySubtitle}
                </Text>
              </Stack>
            </Center>
          ) : (
            <>
              <Table.ScrollContainer minWidth={780} visibleFrom="md">
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        {messages.adminConsultations.tableHeaders.studentAccount}
                      </Table.Th>
                      <Table.Th>
                        {messages.adminConsultations.tableHeaders.attendeeName}
                      </Table.Th>
                      <Table.Th>
                        {messages.adminConsultations.tableHeaders.reason}
                      </Table.Th>
                      <Table.Th>
                        {messages.adminConsultations.tableHeaders.schedule}
                      </Table.Th>
                      <Table.Th>
                        {messages.adminConsultations.tableHeaders.status}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {consultations.map((item) => (
                      <Table.Tr
                        key={item.id}
                        data-testid={`admin-consultation-row-${item.id}`}
                      >
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {item.studentProfileName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {item.studentEmail}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {item.firstName} {item.lastName}
                          </Text>
                        </Table.Td>
                        <Table.Td maw={320}>
                          <Text size="sm" lineClamp={2}>
                            {item.reason}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {formatConsultationRange(
                              item.startsAt,
                              item.endsAt,
                              locale,
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge status={item.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              <Stack gap="sm" hiddenFrom="md">
                {consultations.map((item) => (
                  <Card
                    key={item.id}
                    padding="md"
                    data-testid={`admin-consultation-card-${item.id}`}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Text fw={600} size="sm">
                            {item.firstName} {item.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {item.studentEmail}
                          </Text>
                        </div>
                        <StatusBadge status={item.status} />
                      </Group>

                      <Text size="sm">{item.reason}</Text>
                      <Text size="xs" c="dimmed">
                        {formatConsultationRange(
                          item.startsAt,
                          item.endsAt,
                          locale,
                        )}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>

              {totalPages > 1 && (
                <Group justify="flex-end">
                  <Pagination
                    total={totalPages}
                    value={page}
                    onChange={setPage}
                  />
                </Group>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function AdminConsultationsPage() {
  return (
    <PermissionGuard required={[PERMISSIONS.CONSULTATIONS_READ_ALL]}>
      <AdminConsultationsContent />
    </PermissionGuard>
  );
}
