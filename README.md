# Contour Mini LMS

This app is a mini LMS for consultation booking and dynamic role access control.

## Live Preview

Visit a deployed sample at https://contour-lms-mini.sate.li

Sign-ups are disabled on this instance. Check seeding script for sample Student/Auditor/Super-admin login credentials.

## AI Usage disclosure

/goal (spec driven) with Antigravity with Gemini 4 Neon as Orchestrator. 

## Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime and package manager**: Bun (`vercel.json` sets `"bunVersion": "1.x"`)
- **Auth and database**: `@supabase/supabase-js`, `@supabase/ssr`, and PostgreSQL
- **UI**: Mantine v8 components and CSS tokens
- **Tests**: Bun test runner and Playwright

## Features

1. **Authentication**: Users can sign up, sign in, and sign out. `src/proxy.ts` refreshes HTTP-only session cookies on each request.
2. **Student Dashboard (`/dashboard`)**:
   - View personal consultations, summary counts, status filters, and search results.
   - Book a consultation with first name, last name, reason, start time, and end time.
   - Mark a consultation complete or incomplete.
   - Reschedule or cancel a scheduled consultation.
3. **Admin Consultations View (`/admin/consultations`)**:
   - View all consultations across the system in read-only mode.
   - Filter by status, search by student email or reason, and browse pages.
4. **Super Admin Role View (`/admin/roles`)**:
   - Create, edit, and delete custom roles made from access attributes.
   - Assign one or more roles to each user.
5. **Internationalization (`en` and `zh-CN`) and User Settings (`/settings`)**:
   - Support English (`en`) and Simplified Chinese (`zh-CN`) across all views and date formats.
   - Detect visitor language from the `Accept-Language` header.
   - Save a user's language choice in `profiles.preferred_locale` (existing users default to `en`).
6. **API Routes Only**: All reads and writes call `/api/*` route handlers. The app uses zero Server Actions.

---

## Architecture

### Attribute-Based Access Control

The app does not hardcode role names such as `STUDENT` or `ADMIN`. All access checks read atomic permission attributes.

- **Tables**: `profiles`, `permissions`, `roles`, `role_permissions`, `user_roles`, and `consultations`.
- **Sign-up trigger**: On sign-up, `handle_new_user()` creates a `profiles` row and assigns the role where `is_default = true`.
- **Effective permissions**: Each user gets the combined permissions from all assigned roles.
- **Three check layers**:
  - **UI**: `AppShellLayout` and `PermissionGuard` render links and actions that match `effectivePermissions`.
  - **API**: `requirePermissions()` checks required attributes on every `/api/*` request.
  - **Database**: PostgreSQL RLS policies call `public.has_permission(auth.uid(), '<key>')`.
- **Lockout guard**:
  - You cannot delete roles marked `is_system = true` or `is_default = true`.
  - The API blocks changes that remove the last user with `roles:manage` or `users:assign_roles`.

### Next.js 16, Bun, and Mantine

- `src/proxy.ts` exports `proxy()` instead of `middleware.ts` to refresh sessions and protect routes.
- `package.json` runs `next dev --webpack` and `next build --webpack` under `bun --bun`.
- Views show tables on `md` screens and wider (`visibleFrom="md"`), and card lists on smaller screens (`hiddenFrom="md"`).

---

## Project Layout

```text
├── scripts/
│   └── seed.ts                          # Demo user and consultation seed script
├── supabase/
│   ├── config.toml                      # Local Supabase CLI settings
│   ├── schema.sql                       # Combined schema and RLS SQL snapshot
│   ├── seed.sql                         # Idempotent permissions and starter roles
│   └── migrations/
│       ├── 20261122000001_initial_schema.sql
│       ├── 20261122000002_rls_policies.sql
│       ├── 20261122000003_user_locale_preference.sql
│       └── 20261122000004_drop_unused_get_user_permissions.sql
├── src/
│   ├── proxy.ts                         # Next.js 16 session and route proxy
│   ├── theme.ts                         # Mantine theme tokens
│   ├── app/
│   │   ├── (auth)/login/ & signup/      # Login and sign-up pages
│   │   ├── (app)/dashboard/             # Student consultation dashboard
│   │   ├── (app)/settings/              # User profile and language settings
│   │   ├── (app)/admin/consultations/   # Read-only all-consultations view
│   │   ├── (app)/admin/roles/           # Custom role composer and user role view
│   │   ├── (app)/no-access/             # Zero-permission fallback page
│   │   └── api/                         # API route handlers
│   ├── components/                      # Mantine UI, i18n, and Auth providers
│   └── lib/
│       ├── i18n/                        # Locale detection and en / zh-CN messages
│       ├── permissions.ts               # Attribute catalog and permission helpers
│       ├── validation.ts                # Zod schemas and state rules
│       ├── auth-guard.ts                # Server API route guards
│       ├── supabase/                    # SSR and proxy Supabase clients
│       └── repositories/                # SupabaseRepository and MemoryRepository
├── tests/
│   ├── unit/                            # Unit tests
│   ├── integration/                     # API route integration tests
│   └── e2e/                             # Playwright desktop and mobile E2E tests
├── playwright.config.ts
└── vercel.json
```

---

## Database Files and Attributes

### SQL and Seed Files

- `supabase/migrations/20261122000001_initial_schema.sql`: Creates tables, indexes, `updated_at` triggers, `has_permission()`, `get_user_permissions()`, and `handle_new_user()`.
- `supabase/migrations/20261122000002_rls_policies.sql`: Enables RLS on all tables and adds attribute-based policies.
- `supabase/migrations/20261122000003_user_locale_preference.sql`: Adds `preferred_locale` (`en` default) to `profiles` and updates `handle_new_user()`.
- `supabase/migrations/20261122000004_drop_unused_get_user_permissions.sql`: Drops the unused `get_user_permissions()` helper function.
- `supabase/schema.sql`: Combines all migrations into one SQL file.
- `supabase/seed.sql`: Seeds 8 access attributes and 3 starter roles (`learner`, `consultation-auditor`, `super-admin`).
- `scripts/seed.ts`: Creates 3 demo accounts and sample consultations.

### Access Attributes

| Attribute Key | Access Granted |
| --- | --- |
| `consultations:read:own` | View personal consultations on `/dashboard` |
| `consultations:create:own` | Create consultation bookings (`POST /api/consultations`) |
| `consultations:update:own` | Toggle complete status and reschedule own consultations |
| `consultations:cancel:own` | Cancel own scheduled consultations |
| `consultations:read:all` | View all consultations in read-only mode on `/admin/consultations` |
| `roles:read` | View roles, attributes, and user assignments on `/admin/roles` |
| `roles:manage` | Create, edit, and delete custom roles |
| `users:assign_roles` | Assign or remove roles for users |

---

## Local Setup

### Prerequisites

- Install [Bun](https://bun.sh/) `>= 1.3`.
- Install [Supabase CLI](https://supabase.com/docs/guides/cli) with Docker, or create a Supabase cloud project.

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Environment Variables

1. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

2. Set these variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SEED_DEFAULT_PASSWORD=ChangeMe123!
```

### 3. Apply Migrations and Seed Data

#### Option A: Local Supabase CLI

1. Start local Supabase services:

```bash
supabase start
```

2. Run migrations and `supabase/seed.sql`:

```bash
supabase db reset
```

3. Create demo users and sample consultations:

```bash
bun run db:seed
```

#### Option B: Hosted Supabase Project

1. Push migrations to your linked project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL Editor.

2. Run the demo seed script:

```bash
bun run db:seed
```

### 4. Start the App

1. Run the development server:

```bash
bun run dev
```

2. Open `http://localhost:3000`.

Demo accounts from `bun run db:seed` use `SEED_DEFAULT_PASSWORD` (`ChangeMe123!` by default):

- **Learner**: `student@example.org`
- **Auditor (read-only admin)**: `auditor@example.org`
- **Super Admin**: `superadmin@example.org`

---

## Deploy to Vercel

### 1. Set Up Production Supabase

1. Create a project in [Supabase](https://supabase.com/dashboard).
2. Run `supabase/migrations/20261122000001_initial_schema.sql`, `20261122000002_rls_policies.sql`, `20261122000003_user_locale_preference.sql`, and `20261122000004_drop_unused_get_user_permissions.sql` (or `supabase/schema.sql`).
3. Run `supabase/seed.sql`.
4. Open **Authentication → URL Configuration**.
5. Set **Site URL** to `https://your-app.vercel.app`.
6. Add `https://your-app.vercel.app/api/auth/callback` to **Redirect URLs**.
7. Open **Authentication → Providers → Email**.
8. Enable email sign-ups and **Confirm email**.
9. Create your first super admin. Sign up in the app, then run this SQL query:

```sql
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.profiles u
CROSS JOIN public.roles r
WHERE u.email = 'your-admin@yourdomain.com'
  AND r.slug = 'super-admin'
ON CONFLICT DO NOTHING;
```

### 2. Deploy on Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Keep the install command as `bun install` and the build command as `bun run build`.
4. Add these environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (`https://your-app.vercel.app`)
5. Do not set `E2E_TEST_MODE` in production.
6. Deploy the project.

---

## Tests and Checks

### Unit and Integration Tests

Run unit and API integration tests with Bun:

```bash
bun run test
bun run test:unit
bun run test:integration
```

### Playwright E2E Tests

1. Install Chromium once:

```bash
bunx --bun playwright install chromium
```

2. Run the desktop and mobile E2E suite (starts Next.js on port `3100` with `E2E_TEST_MODE=true`):

```bash
bun run test:e2e
```

### Typecheck, Lint, and Build

```bash
bun run typecheck
bun run lint
bun run build
```

---

## API Routes

| Method and Path | Required Attribute | Action |
| --- | --- | --- |
| `POST /api/auth/signup` | Public | Create user and assign default role |
| `POST /api/auth/login` | Public | Sign in and set session cookies |
| `POST /api/auth/logout` | Public | Clear session cookies |
| `GET /api/auth/me` | Signed-in user | Get profile, roles, and effective permissions |
| `PATCH /api/user/settings` | Signed-in user | Update user language preference (`en` or `zh-CN`) |
| `GET /api/auth/callback` | Public | Exchange PKCE auth code for session |
| `GET /api/consultations` | `consultations:read:own` | Get caller consultations and stats |
| `POST /api/consultations` | `consultations:create:own` | Create a consultation |
| `PATCH /api/consultations/[id]` | `consultations:update:own` or `consultations:cancel:own` | Complete, reschedule, or cancel own consultation |
| `GET /api/admin/consultations` | `consultations:read:all` | Get all consultations with search and pages |
| `GET /api/admin/roles` | `roles:read` \| `roles:manage` \| `users:assign_roles` | Get roles, attributes, and user counts |
| `POST /api/admin/roles` | `roles:manage` | Create a custom role |
| `PATCH /api/admin/roles/[id]` | `roles:manage` | Update role metadata or attributes |
| `DELETE /api/admin/roles/[id]` | `roles:manage` | Delete a custom non-system, non-default role |
| `GET /api/admin/users` | `roles:read` \| `roles:manage` \| `users:assign_roles` | Get users, roles, and effective permissions |
| `PUT /api/admin/users/[id]/roles` | `users:assign_roles` | Replace roles for a user |
