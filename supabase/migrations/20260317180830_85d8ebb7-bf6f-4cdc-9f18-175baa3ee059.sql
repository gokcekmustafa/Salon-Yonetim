CREATE TABLE public.company_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  personal_phone TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  identity_type TEXT NOT NULL,
  birth_date DATE NOT NULL,
  email TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  company_name TEXT NOT NULL,
  company_phone TEXT NOT NULL,
  company_phone_secondary TEXT,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  CONSTRAINT company_registration_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT company_registration_requests_identity_type_check CHECK (identity_type IN ('tc', 'passport')),
  CONSTRAINT company_registration_requests_username_key UNIQUE (username)
);

ALTER TABLE public.company_registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can create company registration requests"
ON public.company_registration_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

CREATE POLICY "Super admin manages company registration requests"
ON public.company_registration_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_company_registration_requests_status_created_at
ON public.company_registration_requests(status, created_at DESC);

CREATE INDEX idx_company_registration_requests_email
ON public.company_registration_requests(email);

CREATE OR REPLACE FUNCTION public.update_company_registration_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_company_registration_requests_updated_at ON public.company_registration_requests;
CREATE TRIGGER update_company_registration_requests_updated_at
BEFORE UPDATE ON public.company_registration_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_company_registration_requests_updated_at();