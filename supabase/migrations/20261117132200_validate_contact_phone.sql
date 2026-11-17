CREATE OR REPLACE FUNCTION public.validate_contact_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  phone_digits text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.phone !~ '^\+?[0-9][0-9 ()-]*$' THEN
    RAISE EXCEPTION 'Enter a valid phone number using digits and standard phone punctuation.'
      USING ERRCODE = '22023';
  END IF;

  phone_digits := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  IF length(phone_digits) NOT BETWEEN 8 AND 15 THEN
    RAISE EXCEPTION 'Enter a phone number containing 8 to 15 digits.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER profiles_validate_contact_phone
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_phone();

CREATE TRIGGER businesses_validate_contact_phone
BEFORE INSERT OR UPDATE OF phone ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_phone();
