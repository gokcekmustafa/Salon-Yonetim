
ALTER TABLE public.customer_contracts
  ADD COLUMN IF NOT EXISTS contract_payment_type text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL;
