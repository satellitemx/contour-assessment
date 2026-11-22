-- Remove unused helper function (RLS and queries do not invoke get_user_permissions)
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);
