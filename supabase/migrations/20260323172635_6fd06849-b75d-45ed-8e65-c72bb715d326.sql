
-- Product categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own product categories" ON public.product_categories
  FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "Salon members manage own product categories" ON public.product_categories
  FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id))
  WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "Super admin manages all product categories" ON public.product_categories
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own products" ON public.products
  FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "Salon members manage own products" ON public.products
  FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id))
  WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "Super admin manages all products" ON public.products
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Stock movements table
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'in',
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "Salon members manage own stock movements" ON public.stock_movements
  FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id))
  WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "Super admin manages all stock movements" ON public.stock_movements
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Product sales table
CREATE TABLE public.product_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  sold_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own product sales" ON public.product_sales
  FOR SELECT TO authenticated USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));
CREATE POLICY "Salon members manage own product sales" ON public.product_sales
  FOR ALL TO authenticated USING (is_salon_member(auth.uid(), salon_id))
  WITH CHECK (is_salon_member(auth.uid(), salon_id));
CREATE POLICY "Super admin manages all product sales" ON public.product_sales
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
