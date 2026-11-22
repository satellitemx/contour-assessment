import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PERMISSIONS_SEED = [
  {
    key: 'consultations:read:own',
    resource: 'consultations',
    action: 'read:own',
    label: 'View own consultations',
    description: 'View personal consultation bookings on the student dashboard.',
  },
  {
    key: 'consultations:create:own',
    resource: 'consultations',
    action: 'create:own',
    label: 'Book consultations',
    description: 'Create new consultation bookings for yourself.',
  },
  {
    key: 'consultations:update:own',
    resource: 'consultations',
    action: 'update:own',
    label: 'Update & reschedule own consultations',
    description: 'Mark own consultations complete/incomplete and reschedule bookings.',
  },
  {
    key: 'consultations:cancel:own',
    resource: 'consultations',
    action: 'cancel:own',
    label: 'Cancel own consultations',
    description: 'Cancel scheduled consultation bookings.',
  },
  {
    key: 'consultations:read:all',
    resource: 'consultations',
    action: 'read:all',
    label: 'View all system consultations',
    description: 'Read-only access to view consultations across all users in the system.',
  },
  {
    key: 'roles:read',
    resource: 'roles',
    action: 'read',
    label: 'View roles & users',
    description: 'Inspect defined roles, access attribute compositions, and user role assignments.',
  },
  {
    key: 'roles:manage',
    resource: 'roles',
    action: 'manage',
    label: 'Compose & manage custom roles',
    description: 'Create, update, and delete custom roles and compose their access attributes.',
  },
  {
    key: 'users:assign_roles',
    resource: 'users',
    action: 'assign_roles',
    label: 'Assign roles to users',
    description: 'Assign or revoke composed roles for user accounts.',
  },
];

const STARTER_ROLES = [
  {
    slug: 'learner',
    name: 'Learner',
    description: 'Default role assigned to newly signed-up users with self-service consultation access.',
    is_system: false,
    is_default: true,
    permissions: [
      'consultations:read:own',
      'consultations:create:own',
      'consultations:update:own',
      'consultations:cancel:own',
    ],
  },
  {
    slug: 'consultation-auditor',
    name: 'Consultation Auditor',
    description: 'Read-only reviewer role able to inspect consultations across the entire system.',
    is_system: false,
    is_default: false,
    permissions: ['consultations:read:all'],
  },
  {
    slug: 'super-admin',
    name: 'Platform Super Admin',
    description: 'System bootstrap role with full consultation visibility and custom role composition privileges.',
    is_system: true,
    is_default: false,
    permissions: PERMISSIONS_SEED.map((p) => p.key),
  },
];

const DEMO_USERS = [
  {
    email: 'student@example.org',
    firstName: 'Maya',
    lastName: 'Lin',
    roleSlugs: ['learner'],
  },
  {
    email: 'auditor@example.org',
    firstName: 'Jordan',
    lastName: 'Patel',
    roleSlugs: ['consultation-auditor'],
  },
  {
    email: 'superadmin@example.org',
    firstName: 'Elena',
    lastName: 'Vance',
    roleSlugs: ['super-admin'],
  },
];

async function main() {
  console.log('Seeding permissions...');
  const { error: permError } = await supabase
    .from('permissions')
    .upsert(PERMISSIONS_SEED, { onConflict: 'key' });
  if (permError) throw permError;

  const { data: allPerms, error: fetchPermsError } = await supabase
    .from('permissions')
    .select('id, key');
  if (fetchPermsError) throw fetchPermsError;

  const permIdByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  console.log('Seeding starter roles...');
  const roleIdBySlug = new Map<string, string>();
  for (const roleDef of STARTER_ROLES) {
    const { data: existingRole } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', roleDef.slug)
      .maybeSingle();

    let roleId = existingRole?.id;
    if (!roleId) {
      const { data: inserted, error: insertRoleErr } = await supabase
        .from('roles')
        .insert({
          slug: roleDef.slug,
          name: roleDef.name,
          description: roleDef.description,
          is_system: roleDef.is_system,
          is_default: roleDef.is_default,
        })
        .select('id')
        .single();
      if (insertRoleErr) throw insertRoleErr;
      roleId = inserted.id;
    }

    roleIdBySlug.set(roleDef.slug, roleId);

    const rolePermRows = roleDef.permissions
      .map((key) => permIdByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permission_id) => ({ role_id: roleId!, permission_id }));

    if (rolePermRows.length > 0) {
      const { error: rpErr } = await supabase
        .from('role_permissions')
        .upsert(rolePermRows, { onConflict: 'role_id,permission_id', ignoreDuplicates: true });
      if (rpErr) throw rpErr;
    }
  }

  console.log('Seeding demo users...');
  const { data: existingUsersPage, error: listUsersErr } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  if (listUsersErr) throw listUsersErr;

  const userByEmail = new Map(
    existingUsersPage.users.map((u) => [u.email?.toLowerCase() ?? '', u]),
  );

  const userIdByEmail = new Map<string, string>();

  for (const demo of DEMO_USERS) {
    let user = userByEmail.get(demo.email.toLowerCase());
    if (!user) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: demo.firstName,
          last_name: demo.lastName,
        },
      });
      if (createErr) throw createErr;
      user = created.user;
      console.log(`Created user: ${demo.email}`);
    } else {
      console.log(`User already exists: ${demo.email}`);
    }

    userIdByEmail.set(demo.email, user.id);

    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: demo.email,
        first_name: demo.firstName,
        last_name: demo.lastName,
      },
      { onConflict: 'id' },
    );

    const targetRoleIds = demo.roleSlugs
      .map((slug) => roleIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id));

    await supabase.from('user_roles').delete().eq('user_id', user.id);
    if (targetRoleIds.length > 0) {
      const { error: assignErr } = await supabase.from('user_roles').insert(
        targetRoleIds.map((role_id) => ({
          user_id: user!.id,
          role_id,
        })),
      );
      if (assignErr) throw assignErr;
    }
  }

  const studentId = userIdByEmail.get('student@example.org');
  if (studentId) {
    const { count, error: countErr } = await supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if (countErr) throw countErr;

    if (!count || count === 0) {
      console.log('Seeding sample consultations...');
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      const day = 24 * hour;

      const sampleConsultations = [
        {
          student_id: studentId,
          first_name: 'Maya',
          last_name: 'Lin',
          reason: 'Thesis architecture review and milestone check-in',
          starts_at: new Date(now + 2 * day).toISOString(),
          ends_at: new Date(now + 2 * day + hour).toISOString(),
          status: 'scheduled',
        },
        {
          student_id: studentId,
          first_name: 'Maya',
          last_name: 'Lin',
          reason: 'Algorithms module dynamic programming walkthrough',
          starts_at: new Date(now - 3 * day).toISOString(),
          ends_at: new Date(now - 3 * day + 45 * 60 * 1000).toISOString(),
          status: 'completed',
          completed_at: new Date(now - 3 * day + hour).toISOString(),
        },
        {
          student_id: studentId,
          first_name: 'Maya',
          last_name: 'Lin',
          reason: 'Rescheduled portfolio feedback session',
          starts_at: new Date(now + 5 * day).toISOString(),
          ends_at: new Date(now + 5 * day + 30 * 60 * 1000).toISOString(),
          status: 'cancelled',
          cancelled_at: new Date(now - hour).toISOString(),
        },
      ];

      const { error: insertConsultErr } = await supabase
        .from('consultations')
        .insert(sampleConsultations);
      if (insertConsultErr) throw insertConsultErr;
    }
  }

  console.log('Seed completed successfully.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
