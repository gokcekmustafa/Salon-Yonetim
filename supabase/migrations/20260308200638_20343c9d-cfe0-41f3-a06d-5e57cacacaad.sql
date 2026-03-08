-- Cash boxes for multi-cash management
CREATE TABLE public.cash_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash', -- cash, credit_card, eft
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own cash boxes" ON public.cash_boxes
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon admin manages own cash boxes" ON public.cash_boxes
  FOR ALL TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all cash boxes" ON public.cash_boxes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add cash_box_id and payment_method to cash_transactions
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS cash_box_id uuid REFERENCES public.cash_boxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';

-- Installments table
CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  installment_count integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own installments" ON public.installments
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon admin manages own installments" ON public.installments
  FOR ALL TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all installments" ON public.installments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Installment payments (individual installment records)
CREATE TABLE public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  installment_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own installment payments" ON public.installment_payments
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon admin manages own installment payments" ON public.installment_payments
  FOR ALL TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all installment payments" ON public.installment_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));