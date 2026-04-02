
CREATE TABLE public.customer_session_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_sale_id uuid REFERENCES public.service_sales(id) ON DELETE SET NULL,
  total_sessions integer NOT NULL DEFAULT 1,
  used_sessions integer NOT NULL DEFAULT 0,
  remaining_sessions integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_session_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon members view own session credits"
ON public.customer_session_credits
FOR SELECT
USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon members insert own session credits"
ON public.customer_session_credits
FOR INSERT
WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members update own session credits"
ON public.customer_session_credits
FOR UPDATE
USING (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members delete own session credits"
ON public.customer_session_credits
FOR DELETE
USING (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all session credits"
ON public.customer_session_credits
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_customer_session_credits_updated_at
BEFORE UPDATE ON public.customer_session_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
