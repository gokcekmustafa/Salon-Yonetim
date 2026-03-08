
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages platform settings"
ON public.platform_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- Insert default subscription alert settings
INSERT INTO public.platform_settings (key, value) VALUES (
  'subscription_alert',
  '{"message_expired": "Aboneliğiniz {days} gün önce sona erdi. Lütfen yenileyin.", "message_expiring": "Aboneliğiniz {days} gün sonra ({date}) sona erecek.", "show_days_before": 30}'::jsonb
);
