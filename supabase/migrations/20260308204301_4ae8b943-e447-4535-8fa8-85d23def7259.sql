
CREATE OR REPLACE FUNCTION public.handle_new_salon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create default notification settings
  INSERT INTO public.notification_settings (salon_id, message_template)
  VALUES (NEW.id, 'Merhaba {müşteri_adı}, {tarih} tarihinde saat {saat}''de {hizmet} randevunuz bulunmaktadır. {salon_adı}');

  -- Create default "Merkez" branch
  INSERT INTO public.branches (salon_id, name, is_active)
  VALUES (NEW.id, 'Merkez', true);

  RETURN NEW;
END;
$function$;
