-- Announcements table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  sender_user_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'super_admin',
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'all_salons',
  target_salon_ids uuid[] DEFAULT '{}',
  scheduled_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'announcement',
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS for announcements
CREATE POLICY "Super admin manages all announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Salon admin manages own announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Users view targeted announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    is_active = true 
    AND scheduled_at <= now()
    AND (
      target_type = 'all_salons'
      OR (target_type = 'selected_salons' AND EXISTS (
        SELECT 1 FROM public.salon_members sm 
        WHERE sm.user_id = auth.uid() AND sm.salon_id = ANY(target_salon_ids)
      ))
      OR (target_type = 'salon_customers' AND salon_id IN (
        SELECT get_user_salon_ids(auth.uid())
      ))
    )
  );

-- RLS for notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admin manages all notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin')
    OR (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id))
  );

-- Indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_announcements_salon_id ON public.announcements(salon_id);
CREATE INDEX idx_announcements_scheduled ON public.announcements(scheduled_at);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add updated_at trigger for announcements
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();