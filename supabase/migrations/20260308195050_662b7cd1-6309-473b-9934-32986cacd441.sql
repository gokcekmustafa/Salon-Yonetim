ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tc_kimlik_no text NULL,
  ADD COLUMN IF NOT EXISTS address text NULL,
  ADD COLUMN IF NOT EXISTS secondary_phone text NULL;