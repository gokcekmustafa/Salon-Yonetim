
-- Online status tracking table
CREATE TABLE public.user_online_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

ALTER TABLE public.user_online_status ENABLE ROW LEVEL SECURITY;

-- Super admin can see all
CREATE POLICY "Super admin views all online status"
ON public.user_online_status FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Salon members see their salon's online status
CREATE POLICY "Salon members view own salon online status"
ON public.user_online_status FOR SELECT
TO authenticated
USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

-- Users can upsert their own status
CREATE POLICY "Users upsert own online status"
ON public.user_online_status FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own online status"
ON public.user_online_status FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Audit log table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  user_role text,
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  salon_name text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  target_label text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can see all audit logs
CREATE POLICY "Super admin views all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Salon admin can see their own salon's audit logs
CREATE POLICY "Salon admin views own salon audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (is_salon_admin(auth.uid(), salon_id));

-- Authenticated users can insert audit logs (for their own actions)
CREATE POLICY "Authenticated users insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Super admin can insert for any user (system actions)
CREATE POLICY "Super admin inserts all audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index for performance
CREATE INDEX idx_audit_logs_salon_id ON public.audit_logs(salon_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_user_online_status_salon ON public.user_online_status(salon_id);
