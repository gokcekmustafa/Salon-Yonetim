-- Branch isolation hardening for staff users

-- 1) Add branch linkage to customers and payments
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS branch_id uuid;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_branch_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_branch_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_salon_branch ON public.customers(salon_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_salon_branch ON public.payments(salon_id, branch_id);

-- 2) Backfill missing branch memberships from staff records
UPDATE public.salon_members sm
SET branch_id = st.branch_id
FROM public.staff st
WHERE sm.user_id = st.user_id
  AND sm.salon_id = st.salon_id
  AND sm.role = 'staff'
  AND sm.branch_id IS NULL
  AND st.branch_id IS NOT NULL;

-- 3) Backfill customers.branch_id for existing rows
UPDATE public.customers c
SET branch_id = st.branch_id
FROM public.staff st
WHERE c.branch_id IS NULL
  AND c.assigned_staff_id = st.id
  AND st.branch_id IS NOT NULL;

UPDATE public.customers c
SET branch_id = (
  SELECT a.branch_id
  FROM public.appointments a
  WHERE a.customer_id = c.id
    AND a.branch_id IS NOT NULL
  ORDER BY a.start_time DESC
  LIMIT 1
)
WHERE c.branch_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.appointments a2
    WHERE a2.customer_id = c.id
      AND a2.branch_id IS NOT NULL
  );

UPDATE public.customers c
SET branch_id = (
  SELECT b.id
  FROM public.branches b
  WHERE b.salon_id = c.salon_id
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE c.branch_id IS NULL;

-- 4) Backfill payments.branch_id from linked appointments
UPDATE public.payments p
SET branch_id = a.branch_id
FROM public.appointments a
WHERE p.branch_id IS NULL
  AND p.appointment_id = a.id
  AND a.branch_id IS NOT NULL;

-- 5) Security definer helper for branch access
CREATE OR REPLACE FUNCTION public.can_access_branch(_salon_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN true;
  END IF;

  IF public.is_salon_admin(auth.uid(), _salon_id) THEN
    RETURN true;
  END IF;

  IF _branch_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.salon_members sm
    WHERE sm.user_id = auth.uid()
      AND sm.salon_id = _salon_id
      AND sm.role = 'staff'
      AND sm.branch_id = _branch_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_branch(_user_id uuid, _salon_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.branch_id
  FROM public.salon_members sm
  WHERE sm.user_id = _user_id
    AND sm.salon_id = _salon_id
    AND sm.role = 'staff'
  LIMIT 1
$$;

-- 6) Trigger-level branch enforcement for authenticated staff mutations
CREATE OR REPLACE FUNCTION public.enforce_branch_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_branch uuid;
BEGIN
  -- Always validate branch belongs to same salon when branch_id is present
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.salon_id = NEW.salon_id
  ) THEN
    RAISE EXCEPTION 'Seçilen şube bu salona ait değil.';
  END IF;

  -- Public booking flow (anon) bypasses staff enforcement
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'super_admin'::app_role)
     OR public.is_salon_admin(auth.uid(), NEW.salon_id) THEN
    RETURN NEW;
  END IF;

  v_staff_branch := public.get_staff_branch(auth.uid(), NEW.salon_id);

  IF v_staff_branch IS NULL THEN
    RAISE EXCEPTION 'Şube atamanız bulunmuyor.';
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := v_staff_branch;
  ELSIF NEW.branch_id <> v_staff_branch THEN
    RAISE EXCEPTION 'Sadece kendi şubenizde işlem yapabilirsiniz.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_branch_customers ON public.customers;
CREATE TRIGGER trg_enforce_branch_customers
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_scope();

DROP TRIGGER IF EXISTS trg_enforce_branch_appointments ON public.appointments;
CREATE TRIGGER trg_enforce_branch_appointments
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_scope();

DROP TRIGGER IF EXISTS trg_enforce_branch_payments ON public.payments;
CREATE TRIGGER trg_enforce_branch_payments
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_scope();

-- 7) Tighten RLS by branch for staff users

-- salon_members: staff sees only own member row, admins keep full salon visibility
DROP POLICY IF EXISTS "Members view own salon members" ON public.salon_members;
CREATE POLICY "Salon admins view salon members"
ON public.salon_members
FOR SELECT
TO authenticated
USING (public.is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Staff view own membership"
ON public.salon_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- branches
DROP POLICY IF EXISTS "Salon members view own branches" ON public.branches;
DROP POLICY IF EXISTS "Salon members insert own branches" ON public.branches;
DROP POLICY IF EXISTS "Salon members update own branches" ON public.branches;
DROP POLICY IF EXISTS "Salon members delete own branches" ON public.branches;

CREATE POLICY "Salon admins manage own branches"
ON public.branches
FOR ALL
TO authenticated
USING (public.is_salon_admin(auth.uid(), salon_id))
WITH CHECK (public.is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Staff view assigned branch"
ON public.branches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.salon_members sm
    WHERE sm.user_id = auth.uid()
      AND sm.salon_id = branches.salon_id
      AND sm.role = 'staff'
      AND sm.branch_id = branches.id
  )
);

-- staff
DROP POLICY IF EXISTS "Salon members view own staff" ON public.staff;
DROP POLICY IF EXISTS "Salon members insert own staff" ON public.staff;
DROP POLICY IF EXISTS "Salon members update own staff" ON public.staff;
DROP POLICY IF EXISTS "Salon members delete own staff" ON public.staff;

CREATE POLICY "Salon users view permitted staff"
ON public.staff
FOR SELECT
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users insert permitted staff"
ON public.staff
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users update permitted staff"
ON public.staff
FOR UPDATE
TO authenticated
USING (public.can_access_branch(salon_id, branch_id))
WITH CHECK (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users delete permitted staff"
ON public.staff
FOR DELETE
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

-- appointments
DROP POLICY IF EXISTS "Salon members view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Salon staff manages own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Salon staff updates own appointments" ON public.appointments;

CREATE POLICY "Salon users view permitted appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users insert permitted appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users update permitted appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (public.can_access_branch(salon_id, branch_id))
WITH CHECK (public.can_access_branch(salon_id, branch_id));

-- customers
DROP POLICY IF EXISTS "Public creates customers for booking" ON public.customers;
DROP POLICY IF EXISTS "Salon members view own customers" ON public.customers;
DROP POLICY IF EXISTS "Salon staff manages own customers" ON public.customers;
DROP POLICY IF EXISTS "Salon staff updates own customers" ON public.customers;
DROP POLICY IF EXISTS "Salon members delete own customers" ON public.customers;

CREATE POLICY "Public creates customers for booking"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.salons s
    WHERE s.id = customers.salon_id
      AND s.is_active = true
  )
  AND (
    customers.branch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = customers.branch_id
        AND b.salon_id = customers.salon_id
        AND b.is_active = true
    )
  )
);

CREATE POLICY "Salon users view permitted customers"
ON public.customers
FOR SELECT
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users insert permitted customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users update permitted customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.can_access_branch(salon_id, branch_id))
WITH CHECK (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users delete permitted customers"
ON public.customers
FOR DELETE
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

-- payments
DROP POLICY IF EXISTS "Salon members view own payments" ON public.payments;
DROP POLICY IF EXISTS "Salon admin inserts own payments" ON public.payments;

CREATE POLICY "Salon users view permitted payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.can_access_branch(salon_id, branch_id));

CREATE POLICY "Salon users insert permitted payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_branch(salon_id, branch_id));