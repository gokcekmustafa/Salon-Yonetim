
-- Cash transactions table
CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'income' CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL,
  description text,
  transaction_date timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin manages all cash transactions"
  ON public.cash_transactions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Salon admin view own
CREATE POLICY "Salon admin views own cash transactions"
  ON public.cash_transactions FOR SELECT
  USING (is_salon_admin(auth.uid(), salon_id));

-- Salon admin insert own
CREATE POLICY "Salon admin inserts own cash transactions"
  ON public.cash_transactions FOR INSERT
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

-- Salon admin update own
CREATE POLICY "Salon admin updates own cash transactions"
  ON public.cash_transactions FOR UPDATE
  USING (is_salon_admin(auth.uid(), salon_id));

-- Salon admin delete own
CREATE POLICY "Salon admin deletes own cash transactions"
  ON public.cash_transactions FOR DELETE
  USING (is_salon_admin(auth.uid(), salon_id));

-- Salon members (staff) can view
CREATE POLICY "Salon members view cash transactions"
  ON public.cash_transactions FOR SELECT
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
