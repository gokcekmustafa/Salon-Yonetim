CREATE TABLE public.salon_navigation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL,
  user_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT salon_navigation_preferences_unique UNIQUE (salon_id, user_id, item_key)
);

ALTER TABLE public.salon_navigation_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon users view own navigation preferences"
ON public.salon_navigation_preferences
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND salon_id IN (SELECT get_user_salon_ids(auth.uid()))
);

CREATE POLICY "Salon users insert own navigation preferences"
ON public.salon_navigation_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND salon_id IN (SELECT get_user_salon_ids(auth.uid()))
);

CREATE POLICY "Salon users update own navigation preferences"
ON public.salon_navigation_preferences
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND salon_id IN (SELECT get_user_salon_ids(auth.uid()))
)
WITH CHECK (
  auth.uid() = user_id
  AND salon_id IN (SELECT get_user_salon_ids(auth.uid()))
);

CREATE POLICY "Salon users delete own navigation preferences"
ON public.salon_navigation_preferences
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND salon_id IN (SELECT get_user_salon_ids(auth.uid()))
);

CREATE POLICY "Super admin manages all navigation preferences"
ON public.salon_navigation_preferences
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_salon_navigation_preferences_user_salon
ON public.salon_navigation_preferences (user_id, salon_id, sort_order);

CREATE TRIGGER update_salon_navigation_preferences_updated_at
BEFORE UPDATE ON public.salon_navigation_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();