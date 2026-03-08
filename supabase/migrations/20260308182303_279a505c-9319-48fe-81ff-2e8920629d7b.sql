
CREATE POLICY "Salon admin can update own salon"
ON public.salons
FOR UPDATE
TO authenticated
USING (is_salon_admin(auth.uid(), id))
WITH CHECK (is_salon_admin(auth.uid(), id));
