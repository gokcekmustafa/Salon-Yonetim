
-- Staff salary profiles
CREATE TABLE public.staff_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id)
);

ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admin manages own staff salaries" ON public.staff_salaries FOR ALL
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Salon members view own staff salaries" ON public.staff_salaries FOR SELECT
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Super admin manages all staff salaries" ON public.staff_salaries FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Staff payments
CREATE TABLE public.staff_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL DEFAULT 'salary',
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  cash_box_id UUID REFERENCES public.cash_boxes(id) ON DELETE SET NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admin manages own staff payments" ON public.staff_payments FOR ALL
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Salon members view own staff payments" ON public.staff_payments FOR SELECT
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Super admin manages all staff payments" ON public.staff_payments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers
CREATE TRIGGER update_staff_salaries_updated_at BEFORE UPDATE ON public.staff_salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
