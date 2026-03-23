
-- Create standard_rooms table
CREATE TABLE public.standard_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  room_number text,
  capacity integer DEFAULT 1,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standard_rooms ENABLE ROW LEVEL SECURITY;

-- Super admin can manage
CREATE POLICY "Super admin manages standard rooms"
  ON public.standard_rooms FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- All authenticated users can read (for salon setup)
CREATE POLICY "Authenticated users read standard rooms"
  ON public.standard_rooms FOR SELECT
  TO authenticated
  USING (true);

-- Update handle_new_salon to auto-add standard rooms
CREATE OR REPLACE FUNCTION public.handle_new_salon()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Create default notification settings
  INSERT INTO public.notification_settings (salon_id, message_template)
  VALUES (NEW.id, 'Merhaba {müşteri_adı}, {tarih} tarihinde saat {saat}''de {hizmet} randevunuz bulunmaktadır. {salon_adı}');

  -- Create default "Merkez" branch
  INSERT INTO public.branches (salon_id, name, is_active)
  VALUES (NEW.id, 'Merkez', true);

  -- Auto-add standard rooms
  INSERT INTO public.rooms (salon_id, name, room_number, capacity, description)
  SELECT NEW.id, sr.name, sr.room_number, sr.capacity, sr.description
  FROM public.standard_rooms sr;

  RETURN NEW;
END;
$function$;
