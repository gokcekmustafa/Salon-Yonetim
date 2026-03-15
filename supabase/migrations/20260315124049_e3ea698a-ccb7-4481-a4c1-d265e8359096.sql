
-- Platform staff permissions: granular control for super admin helpers
CREATE TABLE public.platform_staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_manage_salons boolean NOT NULL DEFAULT true,
  can_manage_users boolean NOT NULL DEFAULT true,
  can_manage_announcements boolean NOT NULL DEFAULT true,
  can_manage_popups boolean NOT NULL DEFAULT true,
  can_view_audit_logs boolean NOT NULL DEFAULT true,
  can_manage_data boolean NOT NULL DEFAULT true,
  can_manage_settings boolean NOT NULL DEFAULT true,
  can_view_reports boolean NOT NULL DEFAULT true,
  is_helper boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only super admins can manage this table
ALTER TABLE public.platform_staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages platform staff permissions"
  ON public.platform_staff_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
