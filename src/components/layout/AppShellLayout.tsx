'use client';

import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCalendarEvent,
  IconChevronDown,
  IconClipboardList,
  IconLogout,
  IconMoon,
  IconSchool,
  IconSettings,
  IconShieldLock,
  IconSun,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  getAccessibleNavItems,
  type NavItemDescriptor,
} from '@/lib/permissions';

function getNavIcon(id: NavItemDescriptor['id']) {
  switch (id) {
    case 'dashboard':
      return <IconCalendarEvent size={18} stroke={1.8} />;
    case 'admin-consultations':
      return <IconClipboardList size={18} stroke={1.8} />;
    case 'admin-roles':
      return <IconShieldLock size={18} stroke={1.8} />;
  }
}

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  const { auth, logout } = useAuth();
  const { messages } = useI18n();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  });

  const navItems = getAccessibleNavItems(auth?.effectivePermissions ?? []);
  const fullName = auth
    ? `${auth.user.firstName} ${auth.user.lastName}`.trim() || auth.user.email
    : '';
  const initials = auth
    ? `${auth.user.firstName?.[0] || ''}${auth.user.lastName?.[0] || ''}`.toUpperCase() ||
      auth.user.email[0]?.toUpperCase() ||
      'U'
    : 'U';

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 272,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={{ base: 'sm', sm: 'md', lg: 'lg' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={messages.nav.toggleMenu}
            />
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ThemeIcon size={34} radius="md" variant="filled" color="indigo">
                <IconSchool size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={700} size="sm" lh={1.15}>
                  {messages.common.appName}
                </Text>
                <Text size="xs" c="dimmed" lh={1.15} visibleFrom="xs">
                  {messages.common.appTagline}
                </Text>
              </Box>
            </Link>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Tooltip
              label={
                computedColorScheme === 'dark'
                  ? messages.nav.switchToLight
                  : messages.nav.switchToDark
              }
            >
              <ActionIcon
                variant="default"
                size="lg"
                aria-label={messages.nav.toggleColorScheme}
                onClick={() =>
                  setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')
                }
              >
                {computedColorScheme === 'dark' ? (
                  <IconSun size={18} />
                ) : (
                  <IconMoon size={18} />
                )}
              </ActionIcon>
            </Tooltip>

            {auth && (
              <Menu shadow="md" width={260} position="bottom-end">
                <Menu.Target>
                  <Button
                    variant="subtle"
                    color="gray"
                    px="xs"
                    data-testid="user-menu-button"
                    rightSection={<IconChevronDown size={14} />}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Avatar size={28} radius="xl" color="indigo">
                        {initials}
                      </Avatar>
                      <Text size="sm" fw={500} visibleFrom="sm" lineClamp={1} maw={150}>
                        {fullName}
                      </Text>
                    </Group>
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Box px="sm" py="xs">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {fullName}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {auth.user.email}
                    </Text>
                    <Group gap={4} mt="xs" wrap="wrap">
                      {auth.roles.length > 0 ? (
                        auth.roles.map((role) => (
                          <Badge key={role.id} size="xs" variant="light" color="indigo">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge size="xs" variant="light" color="gray">
                          {messages.nav.noRolesAssigned}
                        </Badge>
                      )}
                    </Group>
                  </Box>
                  <Menu.Divider />
                  <Menu.Item
                    component={Link}
                    href="/settings"
                    leftSection={<IconSettings size={16} />}
                    data-testid="settings-menu-item"
                  >
                    {messages.nav.settings}
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={() => void logout()}
                    data-testid="logout-button"
                  >
                    {messages.nav.signOut}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap="xs">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" px="xs">
              {messages.nav.workspaceHeading}
            </Text>
            {navItems.length === 0 ? (
              <Text size="sm" c="dimmed" px="xs">
                {messages.nav.noCapabilities}
              </Text>
            ) : (
              navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const localized = messages.nav.items[item.id];
                return (
                  <NavLink
                    key={item.id}
                    component={Link}
                    href={item.href}
                    label={localized.label}
                    description={localized.description}
                    leftSection={getNavIcon(item.id)}
                    active={active}
                    variant="light"
                    onClick={close}
                    style={{ borderRadius: 'var(--mantine-radius-md)' }}
                  />
                );
              })
            )}

            <Divider my="xs" />

            <NavLink
              component={Link}
              href="/settings"
              label={messages.nav.settings}
              leftSection={<IconSettings size={18} stroke={1.8} />}
              active={pathname === '/settings'}
              variant="light"
              onClick={close}
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            />
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
