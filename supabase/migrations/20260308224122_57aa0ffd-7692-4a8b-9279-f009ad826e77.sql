
-- Add missing DELETE policy for customers table (salon admin)
CREATE POLICY "Salon admin deletes own customers"
ON public.customers
FOR DELETE
TO authenticated
USING (is_salon_admin(auth.uid(), salon_id));

-- Add missing DELETE policy for staff table (salon admin)
CREATE POLICY "Salon admin deletes own staff"
ON public.staff
FOR DELETE
TO authenticated
USING (is_salon_admin(auth.uid(), salon_id));
