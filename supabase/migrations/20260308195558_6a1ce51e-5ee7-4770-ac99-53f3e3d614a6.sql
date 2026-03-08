ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source_type text NULL,
  ADD COLUMN IF NOT EXISTS source_detail text NULL;