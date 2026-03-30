CREATE POLICY "Salon admins delete own appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (can_access_branch(salon_id, branch_id));