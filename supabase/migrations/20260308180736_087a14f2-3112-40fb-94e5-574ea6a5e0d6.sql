-- Create storage bucket for salon logos
INSERT INTO storage.buckets (id, name, public) VALUES ('salon-logos', 'salon-logos', true);

-- RLS: Salon admins can upload logos for their own salon
CREATE POLICY "Salon admin uploads own logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'salon-logos' AND
  (
    public.has_role(auth.uid(), 'super_admin') OR
    public.is_salon_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- RLS: Salon admins can update their own logos
CREATE POLICY "Salon admin updates own logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'salon-logos' AND
  (
    public.has_role(auth.uid(), 'super_admin') OR
    public.is_salon_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- RLS: Salon admins can delete their own logos
CREATE POLICY "Salon admin deletes own logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'salon-logos' AND
  (
    public.has_role(auth.uid(), 'super_admin') OR
    public.is_salon_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- RLS: Anyone can view salon logos (public bucket)
CREATE POLICY "Public views salon logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'salon-logos');