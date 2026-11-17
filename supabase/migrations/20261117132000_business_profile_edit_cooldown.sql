ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS profile_edit_locked_until timestamptz;

COMMENT ON COLUMN public.businesses.profile_edit_locked_until IS
  'Business profile and logo edits are blocked until this timestamp; NULL means editable.';

CREATE OR REPLACE FUNCTION public.enforce_business_profile_edit_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
    OR NEW.business_type IS DISTINCT FROM OLD.business_type
    OR NEW.address IS DISTINCT FROM OLD.address
    OR NEW.district IS DISTINCT FROM OLD.district
    OR NEW.phone IS DISTINCT FROM OLD.phone
    OR NEW.logo_path IS DISTINCT FROM OLD.logo_path
  THEN
    IF OLD.profile_edit_locked_until IS NOT NULL
      AND OLD.profile_edit_locked_until > statement_timestamp()
    THEN
      RAISE EXCEPTION 'Business profile edits are temporarily locked until %.', OLD.profile_edit_locked_until
        USING ERRCODE = '42501';
    END IF;

    NEW.profile_edit_locked_until := statement_timestamp() + INTERVAL '7 days';
  ELSE
    NEW.profile_edit_locked_until := OLD.profile_edit_locked_until;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_profile_edit_cooldown ON public.businesses;

CREATE TRIGGER businesses_profile_edit_cooldown
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_profile_edit_cooldown();
