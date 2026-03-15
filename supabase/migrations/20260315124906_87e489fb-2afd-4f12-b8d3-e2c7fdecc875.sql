
-- Support ticket types enum
CREATE TYPE public.ticket_type AS ENUM ('support', 'suggestion', 'complaint');

-- Support ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('pending', 'in_progress', 'resolved');

-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  assigned_to uuid,
  title text NOT NULL,
  message text NOT NULL,
  type ticket_type NOT NULL DEFAULT 'support',
  status ticket_status NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ticket replies table
CREATE TABLE public.ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  user_role text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Salon members can view their own salon's tickets
CREATE POLICY "Salon members view own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (is_salon_member(auth.uid(), salon_id));

-- Salon admins can create tickets
CREATE POLICY "Salon admins create tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (is_salon_admin(auth.uid(), salon_id));

-- Salon admins can update their own tickets (e.g. add info)
CREATE POLICY "Salon admins update own tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (is_salon_admin(auth.uid(), salon_id));

-- Super admin manages all tickets
CREATE POLICY "Super admin manages all tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS for ticket_replies
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Salon members can view replies on their salon's tickets
CREATE POLICY "Salon members view ticket replies"
  ON public.ticket_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_replies.ticket_id
    AND is_salon_member(auth.uid(), t.salon_id)
  ));

-- Salon admins can reply to their own tickets
CREATE POLICY "Salon admins insert replies"
  ON public.ticket_replies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_replies.ticket_id
    AND is_salon_admin(auth.uid(), t.salon_id)
  ));

-- Super admin manages all replies
CREATE POLICY "Super admin manages all replies"
  ON public.ticket_replies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Indexes
CREATE INDEX idx_support_tickets_salon_id ON public.support_tickets(salon_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_ticket_replies_ticket_id ON public.ticket_replies(ticket_id);
