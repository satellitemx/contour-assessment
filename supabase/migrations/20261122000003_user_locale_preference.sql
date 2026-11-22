-- Add user language preference to profiles (defaults to English for existing users)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'zh-CN'));

-- Update new-user trigger to honor optional preferred_locale metadata while defaulting to 'en'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id uuid;
  v_first_name text;
  v_last_name text;
  v_locale text;
BEGIN
  v_first_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''), '');
  v_last_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''), '');
  v_locale := CASE
    WHEN (NEW.raw_user_meta_data ->> 'preferred_locale') IN ('en', 'zh-CN')
      THEN NEW.raw_user_meta_data ->> 'preferred_locale'
    ELSE 'en'
  END;

  INSERT INTO public.profiles (id, email, first_name, last_name, preferred_locale)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_first_name, v_last_name, v_locale)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE public.profiles.first_name END,
        last_name = CASE WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name ELSE public.profiles.last_name END;

  SELECT id INTO default_role_id
  FROM public.roles
  WHERE is_default = true
  LIMIT 1;

  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, default_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
