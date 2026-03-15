
-- 1. Add room_number to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_number text;

-- 2. Service categories table
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON public.service_categories FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "sc_member_all" ON public.service_categories FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id)) WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "sc_super" ON public.service_categories FOR ALL TO public USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "sc_anon_read" ON public.service_categories FOR SELECT TO anon USING (true);

-- 3. Add category_id to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- 4. Staff details table
CREATE TABLE IF NOT EXISTS public.staff_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL UNIQUE REFERENCES public.staff(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  surname text,
  tc_no text,
  birth_date date,
  gender text,
  secondary_phone text,
  address text,
  department text,
  start_date date,
  working_hours jsonb DEFAULT '{}',
  experiences text[] DEFAULT '{}',
  offered_services text[] DEFAULT '{}',
  bonus_type text DEFAULT 'fixed',
  bonus_rate numeric DEFAULT 0,
  reward_description text,
  payment_period text DEFAULT 'monthly',
  salary_notes text,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.staff_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd_select" ON public.staff_details FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "sd_admin_all" ON public.staff_details FOR ALL TO authenticated USING (is_salon_admin(auth.uid(), salon_id)) WITH CHECK (is_salon_admin(auth.uid(), salon_id));
CREATE POLICY "sd_member_insert" ON public.staff_details FOR INSERT TO authenticated WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "sd_super" ON public.staff_details FOR ALL TO public USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
