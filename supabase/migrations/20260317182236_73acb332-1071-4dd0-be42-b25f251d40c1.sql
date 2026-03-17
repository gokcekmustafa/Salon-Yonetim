CREATE OR REPLACE FUNCTION public.is_company_username_available(_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_username TEXT;
BEGIN
  normalized_username := lower(trim(_username));

  IF normalized_username IS NULL OR normalized_username = '' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.company_registration_requests crr
    WHERE lower(crr.username) = normalized_username
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.salons s
    WHERE lower(s.slug) = normalized_username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_company_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_username_available(TEXT) TO anon, authenticated;