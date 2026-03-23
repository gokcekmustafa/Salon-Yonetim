
-- Service sales table
CREATE TABLE public.service_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id),
  customer_id UUID REFERENCES public.customers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  staff_id UUID REFERENCES public.staff(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  sold_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members manage own service sales" ON public.service_sales
  FOR ALL TO authenticated
  USING (is_salon_member(auth.uid(), salon_id))
  WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members view own service sales" ON public.service_sales
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Super admin manages all service sales" ON public.service_sales
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add customer_id to product_sales if not exists
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);
