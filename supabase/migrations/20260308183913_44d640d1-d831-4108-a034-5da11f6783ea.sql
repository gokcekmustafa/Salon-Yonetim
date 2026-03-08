
-- Lead status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'proposal_sent', 'negotiation', 'won', 'lost');

-- Leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  status lead_status NOT NULL DEFAULT 'new',
  source text,
  notes_summary text,
  created_by uuid NOT NULL,
  converted_customer_id uuid REFERENCES public.customers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lead notes table
CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- RLS for leads
CREATE POLICY "Super admin manages all leads"
  ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Salon members view own leads"
  ON public.leads FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon members insert own leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members update own leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members delete own leads"
  ON public.leads FOR DELETE TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id));

-- RLS for lead_notes
CREATE POLICY "Super admin manages all lead notes"
  ON public.lead_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Salon members view own lead notes"
  ON public.lead_notes FOR SELECT TO authenticated
  USING (salon_id IN (SELECT get_user_salon_ids(auth.uid())));

CREATE POLICY "Salon members insert own lead notes"
  ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members delete own lead notes"
  ON public.lead_notes FOR DELETE TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id));

-- Add lead permission to salon_permissions
ALTER TABLE public.salon_permissions ADD COLUMN can_manage_leads boolean NOT NULL DEFAULT true;

-- Indexes for performance
CREATE INDEX idx_leads_salon_id ON public.leads(salon_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes(lead_id);
