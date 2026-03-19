
-- Trigger function: notify super admins on new company registration request
CREATE OR REPLACE FUNCTION public.notify_super_admins_on_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      admin_record.user_id,
      'Yeni Firma Kayıt Başvurusu: ' || NEW.company_name,
      NEW.full_name || ' - ' || NEW.email || ' - ' || NEW.city,
      'registration'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Create trigger on company_registration_requests
CREATE TRIGGER on_new_registration_request
  AFTER INSERT ON public.company_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_super_admins_on_registration();
