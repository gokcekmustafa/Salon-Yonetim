ALTER TABLE public.staff_details
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS profile_photo_url text;