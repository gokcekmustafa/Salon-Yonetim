
-- Allow salon members (staff) to INSERT services (currently only salon_admin)
DROP POLICY IF EXISTS "Salon admin manages own services" ON public.services;
CREATE POLICY "Salon members insert own services" ON public.services FOR INSERT TO authenticated WITH CHECK (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to UPDATE services
DROP POLICY IF EXISTS "Salon admin updates own services" ON public.services;
CREATE POLICY "Salon members update own services" ON public.services FOR UPDATE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to DELETE services
DROP POLICY IF EXISTS "Salon admin deletes own services" ON public.services;
CREATE POLICY "Salon members delete own services" ON public.services FOR DELETE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to view payments (currently only salon_admin SELECT)
DROP POLICY IF EXISTS "Salon admin manages own payments" ON public.payments;
CREATE POLICY "Salon members view own payments" ON public.payments FOR SELECT TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to INSERT branches
DROP POLICY IF EXISTS "Salon admin manages own branches" ON public.branches;
CREATE POLICY "Salon members insert own branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to UPDATE branches
DROP POLICY IF EXISTS "Salon admin updates own branches" ON public.branches;
CREATE POLICY "Salon members update own branches" ON public.branches FOR UPDATE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to DELETE branches
DROP POLICY IF EXISTS "Salon admin deletes own branches" ON public.branches;
CREATE POLICY "Salon members delete own branches" ON public.branches FOR DELETE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to INSERT staff records
DROP POLICY IF EXISTS "Salon admin manages own staff" ON public.staff;
CREATE POLICY "Salon members insert own staff" ON public.staff FOR INSERT TO authenticated WITH CHECK (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to UPDATE staff records
DROP POLICY IF EXISTS "Salon admin updates own staff" ON public.staff;
CREATE POLICY "Salon members update own staff" ON public.staff FOR UPDATE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members (staff) to DELETE staff records
DROP POLICY IF EXISTS "Salon admin deletes own staff" ON public.staff;
CREATE POLICY "Salon members delete own staff" ON public.staff FOR DELETE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to manage customers (DELETE - currently only salon_admin)
DROP POLICY IF EXISTS "Salon admin deletes own customers" ON public.customers;
CREATE POLICY "Salon members delete own customers" ON public.customers FOR DELETE TO authenticated USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to manage notification settings
DROP POLICY IF EXISTS "Salon admin manages own notifications" ON public.notification_settings;
CREATE POLICY "Salon members manage own notifications" ON public.notification_settings FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id));
