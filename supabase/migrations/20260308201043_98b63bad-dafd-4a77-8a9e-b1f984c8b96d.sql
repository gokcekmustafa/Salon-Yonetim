
-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admin manages own templates" ON public.contract_templates FOR ALL
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Salon members view own templates" ON public.contract_templates FOR SELECT
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Super admin manages all templates" ON public.contract_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Customer contracts table
CREATE TABLE public.customer_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  filled_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admin manages own contracts" ON public.customer_contracts FOR ALL
  USING (is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Salon members view own contracts" ON public.customer_contracts FOR SELECT
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon staff creates contracts" ON public.customer_contracts FOR INSERT
  WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Super admin manages all contracts" ON public.customer_contracts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Storage bucket for contract files
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-files', 'contract-files', false);

CREATE POLICY "Salon members upload contract files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-files' AND auth.role() = 'authenticated');

CREATE POLICY "Salon members view contract files" ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-files' AND auth.role() = 'authenticated');

CREATE POLICY "Salon admins delete contract files" ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-files' AND auth.role() = 'authenticated');

-- Triggers
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_contracts_updated_at BEFORE UPDATE ON public.customer_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
