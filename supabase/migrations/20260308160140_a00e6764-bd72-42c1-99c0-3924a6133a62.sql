
-- Fix overly permissive anonymous insert policies
-- Drop the too-permissive ones
DROP POLICY "Public creates customers for booking" ON public.customers;
DROP POLICY "Public creates appointments for booking" ON public.appointments;

-- Recreate with salon_id validation (salon must exist and be active)
CREATE POLICY "Public creates customers for booking" ON public.customers
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.salons WHERE id = customers.salon_id AND is_active = true)
  );

CREATE POLICY "Public creates appointments for booking" ON public.appointments
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.salons WHERE id = appointments.salon_id AND is_active = true)
  );
