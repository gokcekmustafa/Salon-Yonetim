
-- Allow salon members (staff) to insert installments
CREATE POLICY "Salon members insert own installments"
ON public.installments
FOR INSERT
TO authenticated
WITH CHECK (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to update installments
CREATE POLICY "Salon members update own installments"
ON public.installments
FOR UPDATE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to delete installments
CREATE POLICY "Salon members delete own installments"
ON public.installments
FOR DELETE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to insert installment_payments
CREATE POLICY "Salon members insert own installment payments"
ON public.installment_payments
FOR INSERT
TO authenticated
WITH CHECK (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to update installment_payments
CREATE POLICY "Salon members update own installment payments"
ON public.installment_payments
FOR UPDATE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to delete installment_payments
CREATE POLICY "Salon members delete own installment payments"
ON public.installment_payments
FOR DELETE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to delete service_sales
CREATE POLICY "Salon members delete own service sales"
ON public.service_sales
FOR DELETE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to update service_sales
CREATE POLICY "Salon members update own service sales"
ON public.service_sales
FOR UPDATE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to delete product_sales
CREATE POLICY "Salon members delete own product sales"
ON public.product_sales
FOR DELETE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to update product_sales  
CREATE POLICY "Salon members update own product sales"
ON public.product_sales
FOR UPDATE
TO authenticated
USING (is_salon_member(auth.uid(), salon_id));

-- Allow salon members to delete cash_transactions
CREATE POLICY "Salon members insert cash transactions"
ON public.cash_transactions
FOR INSERT
TO authenticated
WITH CHECK (is_salon_member(auth.uid(), salon_id));
