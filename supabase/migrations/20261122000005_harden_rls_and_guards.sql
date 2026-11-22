-- Harden profiles column updates, consultations RLS, duration bounds, and DB state transition guards

-- 1. Restrict profile self-updates to mutable user preference/display fields
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (first_name, last_name, preferred_locale) ON public.profiles TO authenticated;

-- 2. Disallow updates to cancelled consultations at the RLS policy level
DROP POLICY IF EXISTS consultations_update_policy ON public.consultations;
CREATE POLICY consultations_update_policy ON public.consultations
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND status <> 'cancelled'
    AND (
      public.has_permission(auth.uid(), 'consultations:update:own')
      OR public.has_permission(auth.uid(), 'consultations:cancel:own')
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND (
      (status = 'cancelled' AND public.has_permission(auth.uid(), 'consultations:cancel:own'))
      OR (status <> 'cancelled' AND public.has_permission(auth.uid(), 'consultations:update:own'))
    )
  );

-- 3. Enforce consultation duration bounds (5 minutes to 12 hours) for new writes
ALTER TABLE public.consultations
  DROP CONSTRAINT IF EXISTS consultations_duration_bounds;

ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_duration_bounds
  CHECK (
    ends_at >= starts_at + interval '5 minutes'
    AND ends_at <= starts_at + interval '12 hours'
  ) NOT VALID;

-- 4. Guard consultation immutability and status transitions on direct user updates
CREATE OR REPLACE FUNCTION public.guard_consultation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Allow trusted service_role / SQL maintenance operations outside an end-user JWT
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.student_id IS DISTINCT FROM OLD.student_id
    OR NEW.first_name IS DISTINCT FROM OLD.first_name
    OR NEW.last_name IS DISTINCT FROM OLD.last_name
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutable consultation fields cannot be modified.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled consultations cannot be modified.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at)
    AND NOT (OLD.status = 'scheduled' AND NEW.status = 'scheduled') THEN
    RAISE EXCEPTION 'Only scheduled consultations can be rescheduled.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled consultations can be cancelled.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consultations_guard_update ON public.consultations;
CREATE TRIGGER consultations_guard_update
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_consultation_update();
