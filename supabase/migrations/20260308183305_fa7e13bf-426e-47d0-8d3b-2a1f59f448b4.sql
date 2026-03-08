
-- Salon permissions table
CREATE TABLE public.salon_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  can_manage_appointments boolean NOT NULL DEFAULT true,
  can_manage_customers boolean NOT NULL DEFAULT true,
  can_manage_staff boolean NOT NULL DEFAULT true,
  can_manage_payments boolean NOT NULL DEFAULT true,
  can_view_dashboard boolean NOT NULL DEFAULT true,
  can_manage_announcements boolean NOT NULL DEFAULT true,
  can_manage_popups boolean NOT NULL DEFAULT true,
  can_add_branches boolean NOT NULL DEFAULT true,
  can_manage_services boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id)
);

-- Enable RLS
ALTER TABLE public.salon_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin manages all permissions"
  ON public.salon_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Salon members can view their own permissions
CREATE POLICY "Salon members view own permissions"
  ON public.salon_permissions FOR SELECT
  TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

-- Security definer function to check a specific permission
CREATE OR REPLACE FUNCTION public.check_salon_permission(_salon_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Super admins always have permission
  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN true;
  END IF;

  -- Check specific permission
  EXECUTE format('SELECT %I FROM public.salon_permissions WHERE salon_id = $1', _permission)
    INTO result
    USING _salon_id;

  -- If no row exists, default to true (all permissions granted)
  RETURN COALESCE(result, true);
END;
$$;

-- Auto-create permissions row when a salon is created
CREATE OR REPLACE FUNCTION public.handle_new_salon_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.salon_permissions (salon_id)
  VALUES (NEW.id)
  ON CONFLICT (salon_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_salon_created_permissions
  AFTER INSERT ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_salon_permissions();

-- Create permissions rows for existing salons
INSERT INTO public.salon_permissions (salon_id)
SELECT id FROM public.salons
ON CONFLICT (salon_id) DO NOTHING;
