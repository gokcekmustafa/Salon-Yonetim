ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS description text;