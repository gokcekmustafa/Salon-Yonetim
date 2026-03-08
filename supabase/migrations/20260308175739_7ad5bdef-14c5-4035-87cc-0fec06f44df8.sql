
-- Drop all existing restrictive policies on popup_announcements
DROP POLICY IF EXISTS "Super admin manages all popups" ON public.popup_announcements;
DROP POLICY IF EXISTS "Salon admin manages own popups" ON public.popup_announcements;
DROP POLICY IF EXISTS "Users view active popups" ON public.popup_announcements;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Super admin manages all popups"
  ON public.popup_announcements FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Salon admin manages own popups"
  ON public.popup_announcements FOR ALL
  TO authenticated
  USING (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id))
  WITH CHECK (salon_id IS NOT NULL AND is_salon_admin(auth.uid(), salon_id));

CREATE POLICY "Users view active popups"
  ON public.popup_announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true AND (
      (target_type = 'all_salons' AND salon_id IS NULL)
      OR (target_type = 'salon_customers' AND salon_id IN (SELECT get_user_salon_ids(auth.uid())))
    )
  );

-- Fix popup_views policies too
DROP POLICY IF EXISTS "Users insert own views" ON public.popup_views;
DROP POLICY IF EXISTS "Users view own views" ON public.popup_views;
DROP POLICY IF EXISTS "Super admin views all popup views" ON public.popup_views;

CREATE POLICY "Users insert own views"
  ON public.popup_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own views"
  ON public.popup_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admin views all popup views"
  ON public.popup_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
