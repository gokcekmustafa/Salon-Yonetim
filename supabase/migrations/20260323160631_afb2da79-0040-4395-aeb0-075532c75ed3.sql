
-- Create standard_services table (template services for superadmin)
CREATE TABLE public.standard_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  name text NOT NULL,
  duration integer NOT NULL DEFAULT 60,
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standard_services ENABLE ROW LEVEL SECURITY;

-- Super admin can manage
CREATE POLICY "Super admin manages standard services"
  ON public.standard_services FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- All authenticated users can read
CREATE POLICY "Authenticated users read standard services"
  ON public.standard_services FOR SELECT
  TO authenticated
  USING (true);
