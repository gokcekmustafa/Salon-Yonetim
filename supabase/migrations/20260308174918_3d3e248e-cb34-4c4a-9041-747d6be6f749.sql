
CREATE TABLE public.popup_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  link_url text,
  link_label text,
  duration_seconds integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  target_type text NOT NULL DEFAULT 'all_salons',
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.popup_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id uuid NOT NULL REFERENCES public.popup_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(popup_id, user_id)
);

ALTER TABLE public.popup_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_views ENABLE ROW LEVEL SECURITY;

-- Popup announcements policies
CREATE POLICY "Super admin manages all popups"
ON public.popup_announcements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Salon admin manages own popups"
ON public.popup_announcements FOR ALL TO authenticated
USING (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id))
WITH CHECK (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Users view active popups"
ON public.popup_announcements FOR SELECT TO authenticated
USING (
  is_active = true AND (
    (target_type = 'all_salons' AND salon_id IS NULL) OR
    (target_type = 'salon_customers' AND salon_id IN (SELECT get_user_salon_ids(auth.uid())))
  )
);

-- Popup views policies
CREATE POLICY "Users insert own views"
ON public.popup_views FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own views"
ON public.popup_views FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admin views all popup views"
ON public.popup_views FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
