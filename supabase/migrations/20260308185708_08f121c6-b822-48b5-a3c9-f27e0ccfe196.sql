
-- Create storage bucket for system branding logo
INSERT INTO storage.buckets (id, name, public) VALUES ('system-branding', 'system-branding', true);

-- Storage policies: super admin can upload/update/delete, everyone can read
CREATE POLICY "Anyone can view system branding" ON storage.objects FOR SELECT USING (bucket_id = 'system-branding');
CREATE POLICY "Super admin uploads system branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'system-branding' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admin updates system branding" ON storage.objects FOR UPDATE USING (bucket_id = 'system-branding' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admin deletes system branding" ON storage.objects FOR DELETE USING (bucket_id = 'system-branding' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Seed branding settings into platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('company_name', '"SalonYönetim"'::jsonb),
  ('app_name', '"SaaS Platform"'::jsonb),
  ('logo_url', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
