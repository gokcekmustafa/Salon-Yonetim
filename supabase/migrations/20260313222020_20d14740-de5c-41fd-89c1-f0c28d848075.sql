
CREATE TABLE public.user_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_plain text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read passwords"
  ON public.user_passwords
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can manage passwords"
  ON public.user_passwords
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
