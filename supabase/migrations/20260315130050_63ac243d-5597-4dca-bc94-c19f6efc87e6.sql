
-- Create a trigger function to notify super admins when a new ticket is created
CREATE OR REPLACE FUNCTION public.notify_super_admins_on_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
  ticket_type_label TEXT;
  salon_name_val TEXT;
BEGIN
  -- Get salon name
  SELECT name INTO salon_name_val FROM public.salons WHERE id = NEW.salon_id;
  
  -- Get type label
  CASE NEW.type::text
    WHEN 'support' THEN ticket_type_label := 'Destek Talebi';
    WHEN 'suggestion' THEN ticket_type_label := 'Öneri';
    WHEN 'complaint' THEN ticket_type_label := 'Şikayet';
    ELSE ticket_type_label := 'Talep';
  END CASE;

  -- Notify all super admins
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      admin_record.user_id,
      'Yeni ' || ticket_type_label || ': ' || NEW.title,
      COALESCE(salon_name_val, 'Bilinmeyen Salon') || ' - ' || LEFT(NEW.message, 100),
      'ticket'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_new_support_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_super_admins_on_ticket();
