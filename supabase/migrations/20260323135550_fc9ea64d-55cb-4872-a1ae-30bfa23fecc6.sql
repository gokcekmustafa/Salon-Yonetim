
-- Allow salon members (including staff) to insert, update, delete rooms
CREATE POLICY "Salon members insert own rooms"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members update own rooms"
ON public.rooms
FOR UPDATE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

CREATE POLICY "Salon members delete own rooms"
ON public.rooms
FOR DELETE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));
