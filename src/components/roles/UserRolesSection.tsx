'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { userMutationResponseSchema } from '@/lib/contracts';
import { formatMessage } from '@/lib/i18n';
import type { RoleSummary, UserWithRoles } from '@/lib/types';
import { assignUserRolesSchema } from '@/lib/validation';

interface UserRolesSectionProps {
  users: UserWithRoles[];
  roles: RoleSummary[];
  canAssignRoles: boolean;
  onUpdated: () => Promise<void>;
}

export function UserRolesSection({
  users,
  roles,
  canAssignRoles,
  onUpdated,
}: UserRolesSectionProps) {
  const { messages } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string[]>>(
    {},
  );
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: r.id,
        label: r.name,
      })),
    [roles],
  );

  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, searchText]);

  const getDraftRoleIds = (user: UserWithRoles): string[] =>
    draftOverrides[user.id] ?? user.roles.map((r) => r.id);

  const isDirty = (user: UserWithRoles): boolean => {
    const current = [...user.roles.map((r) => r.id)].sort().join(',');
    const draft = [...getDraftRoleIds(user)].sort().join(',');
    return current !== draft;
  };

  const handleSaveUserRoles = async (user: UserWithRoles) => {
    setSavingUserId(user.id);
    try {
      const roleIds = getDraftRoleIds(user);
      await apiRequest(`/api/admin/users/${user.id}/roles`, {
        method: 'PUT',
        requestSchema: assignUserRolesSchema,
        responseSchema: userMutationResponseSchema,
        body: { roleIds },
      });
      setDraftOverrides((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      notifications.show({
        color: 'teal',
        title: messages.userRoles.updatedTitle,
        message: formatMessage(messages.userRoles.updatedBody, {
          email: user.email,
        }),
      });
      await onUpdated();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: messages.userRoles.rejectedTitle,
        message:
          err instanceof ClientApiError
            ? err.message
            : messages.userRoles.rejectedBody,
      });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" c="dimmed">
          {messages.userRoles.introText}
        </Text>
        <TextInput
          placeholder={messages.userRoles.filterPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={searchText}
          onChange={(e) => setSearchText(e.currentTarget.value)}
          w={{ base: '100%', sm: 280 }}
          aria-label={messages.userRoles.filterAriaLabel}
        />
      </Group>

      <Table.ScrollContainer minWidth={780} visibleFrom="md">
        <Table striped verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{messages.userRoles.headers.user}</Table.Th>
              <Table.Th>{messages.userRoles.headers.assignedRoles}</Table.Th>
              <Table.Th>
                {messages.userRoles.headers.effectiveAttributes}
              </Table.Th>
              {canAssignRoles && (
                <Table.Th>{messages.userRoles.headers.save}</Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredUsers.map((user) => (
              <Table.Tr key={user.id} data-testid={`user-row-${user.email}`}>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {`${user.firstName} ${user.lastName}`.trim() || user.email}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {user.email}
                  </Text>
                </Table.Td>
                <Table.Td miw={250}>
                  {canAssignRoles ? (
                    <MultiSelect
                      data={roleOptions}
                      value={getDraftRoleIds(user)}
                      onChange={(vals) =>
                        setDraftOverrides((prev) => ({
                          ...prev,
                          [user.id]: vals,
                        }))
                      }
                      placeholder={messages.userRoles.selectPlaceholder}
                      searchable
                      clearable
                      aria-label={`Roles for ${user.email}`}
                    />
                  ) : (
                    <Group gap={4} wrap="wrap">
                      {user.roles.map((r) => (
                        <Badge key={r.id} size="sm" variant="light">
                          {r.name}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td maw={300}>
                  <Group gap={4} wrap="wrap">
                    {user.effectivePermissions.length > 0 ? (
                      user.effectivePermissions.map((perm) => (
                        <Badge key={perm} size="xs" variant="outline" color="indigo">
                          {perm}
                        </Badge>
                      ))
                    ) : (
                      <Text size="xs" c="dimmed">
                        {messages.common.none}
                      </Text>
                    )}
                  </Group>
                </Table.Td>
                {canAssignRoles && (
                  <Table.Td>
                    <Button
                      size="xs"
                      disabled={!isDirty(user)}
                      loading={savingUserId === user.id}
                      leftSection={<IconDeviceFloppy size={14} />}
                      onClick={() => void handleSaveUserRoles(user)}
                      data-testid={`save-user-roles-${user.email}`}
                    >
                      {messages.common.save}
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Stack gap="sm" hiddenFrom="md">
        {filteredUsers.map((user) => (
          <Card key={user.id} padding="md" data-testid={`user-card-${user.email}`}>
            <Stack gap="sm">
              <div>
                <Text fw={600} size="sm">
                  {`${user.firstName} ${user.lastName}`.trim() || user.email}
                </Text>
                <Text size="xs" c="dimmed">
                  {user.email}
                </Text>
              </div>

              {canAssignRoles ? (
                <MultiSelect
                  label={messages.userRoles.headers.assignedRoles}
                  data={roleOptions}
                  value={getDraftRoleIds(user)}
                  onChange={(vals) =>
                    setDraftOverrides((prev) => ({
                      ...prev,
                      [user.id]: vals,
                    }))
                  }
                  placeholder={messages.userRoles.selectPlaceholder}
                  searchable
                  clearable
                />
              ) : (
                <Group gap={4} wrap="wrap">
                  {user.roles.map((r) => (
                    <Badge key={r.id} size="sm" variant="light">
                      {r.name}
                    </Badge>
                  ))}
                </Group>
              )}

              <Group gap={4} wrap="wrap">
                {user.effectivePermissions.map((perm) => (
                  <Badge key={perm} size="xs" variant="outline" color="indigo">
                    {perm}
                  </Badge>
                ))}
              </Group>

              {canAssignRoles && (
                <Button
                  size="xs"
                  fullWidth
                  disabled={!isDirty(user)}
                  loading={savingUserId === user.id}
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={() => void handleSaveUserRoles(user)}
                >
                  {messages.userRoles.saveMobileButton}
                </Button>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
