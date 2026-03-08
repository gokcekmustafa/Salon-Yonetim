-- Rooms table for session management
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon admin manages own rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add session fields to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_status text NOT NULL DEFAULT 'waiting';

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;