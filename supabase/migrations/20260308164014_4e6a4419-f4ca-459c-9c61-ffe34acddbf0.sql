
-- 1. Create security definer function to get user's salon IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_salon_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT salon_id FROM public.salon_members WHERE user_id = _user_id
$$;

-- 2. Create helper to check if user is salon member with specific role
CREATE OR REPLACE FUNCTION public.is_salon_member(_user_id uuid, _salon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.salon_members
    WHERE user_id = _user_id AND salon_id = _salon_id
  )
$$;

-- 3. Create helper to check salon admin role
CREATE OR REPLACE FUNCTION public.is_salon_admin(_user_id uuid, _salon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.salon_members
    WHERE user_id = _user_id AND salon_id = _salon_id AND role = 'salon_admin'
  )
$$;

-- =============================================
-- FIX salon_members policies (ROOT CAUSE)
-- =============================================
DROP POLICY IF EXISTS "Members view own salon members" ON public.salon_members;
CREATE POLICY "Members view own salon members"
  ON public.salon_members FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

-- =============================================
-- FIX salons policies
-- =============================================
DROP POLICY IF EXISTS "Salon members can view own salon" ON public.salons;
CREATE POLICY "Salon members can view own salon"
  ON public.salons FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_salon_ids(auth.uid())));

-- =============================================
-- FIX branches policies
-- =============================================
DROP POLICY IF EXISTS "Salon members view own branches" ON public.branches;
CREATE POLICY "Salon members view own branches"
  ON public.branches FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

DROP POLICY IF EXISTS "Salon admin manages own branches" ON public.branches;
CREATE POLICY "Salon admin manages own branches"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin updates own branches" ON public.branches;
CREATE POLICY "Salon admin updates own branches"
  ON public.branches FOR UPDATE TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin deletes own branches" ON public.branches;
CREATE POLICY "Salon admin deletes own branches"
  ON public.branches FOR DELETE TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

-- =============================================
-- FIX customers policies
-- =============================================
DROP POLICY IF EXISTS "Salon members view own customers" ON public.customers;
CREATE POLICY "Salon members view own customers"
  ON public.customers FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

DROP POLICY IF EXISTS "Salon staff manages own customers" ON public.customers;
CREATE POLICY "Salon staff manages own customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_member(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon staff updates own customers" ON public.customers;
CREATE POLICY "Salon staff updates own customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.is_salon_member(auth.uid(), salon_id));

-- =============================================
-- FIX services policies
-- =============================================
DROP POLICY IF EXISTS "Salon members view own services" ON public.services;
CREATE POLICY "Salon members view own services"
  ON public.services FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

DROP POLICY IF EXISTS "Salon admin manages own services" ON public.services;
CREATE POLICY "Salon admin manages own services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin updates own services" ON public.services;
CREATE POLICY "Salon admin updates own services"
  ON public.services FOR UPDATE TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin deletes own services" ON public.services;
CREATE POLICY "Salon admin deletes own services"
  ON public.services FOR DELETE TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

-- =============================================
-- FIX staff policies
-- =============================================
DROP POLICY IF EXISTS "Salon members view own staff" ON public.staff;
CREATE POLICY "Salon members view own staff"
  ON public.staff FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

DROP POLICY IF EXISTS "Salon admin manages own staff" ON public.staff;
CREATE POLICY "Salon admin manages own staff"
  ON public.staff FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin updates own staff" ON public.staff;
CREATE POLICY "Salon admin updates own staff"
  ON public.staff FOR UPDATE TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

-- =============================================
-- FIX appointments policies
-- =============================================
DROP POLICY IF EXISTS "Salon members view own appointments" ON public.appointments;
CREATE POLICY "Salon members view own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (salon_id IN (SELECT public.get_user_salon_ids(auth.uid())));

DROP POLICY IF EXISTS "Salon staff manages own appointments" ON public.appointments;
CREATE POLICY "Salon staff manages own appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_member(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon staff updates own appointments" ON public.appointments;
CREATE POLICY "Salon staff updates own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_salon_member(auth.uid(), salon_id));

-- =============================================
-- FIX payments policies
-- =============================================
DROP POLICY IF EXISTS "Salon admin manages own payments" ON public.payments;
CREATE POLICY "Salon admin manages own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));

DROP POLICY IF EXISTS "Salon admin inserts own payments" ON public.payments;
CREATE POLICY "Salon admin inserts own payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_member(auth.uid(), salon_id));

-- =============================================
-- FIX notification_settings policies
-- =============================================
DROP POLICY IF EXISTS "Salon admin manages own notifications" ON public.notification_settings;
CREATE POLICY "Salon admin manages own notifications"
  ON public.notification_settings FOR ALL TO authenticated
  USING (public.is_salon_admin(auth.uid(), salon_id));
