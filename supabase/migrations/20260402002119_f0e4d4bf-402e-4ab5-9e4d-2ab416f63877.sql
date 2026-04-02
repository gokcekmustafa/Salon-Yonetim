
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(_customer_id uuid, _salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_ids uuid[];
  v_installment_ids uuid[];
  v_deleted_appointments int := 0;
  v_deleted_payments int := 0;
  v_deleted_installments int := 0;
  v_deleted_installment_payments int := 0;
  v_deleted_service_sales int := 0;
  v_deleted_product_sales int := 0;
  v_deleted_contracts int := 0;
  v_deleted_cash_transactions int := 0;
  v_customer_name text;
BEGIN
  -- Verify customer exists and belongs to this salon
  SELECT name INTO v_customer_name
  FROM public.customers
  WHERE id = _customer_id AND salon_id = _salon_id;

  IF v_customer_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Müşteri bulunamadı.');
  END IF;

  -- Collect appointment IDs for this customer
  SELECT array_agg(id) INTO v_appointment_ids
  FROM public.appointments
  WHERE customer_id = _customer_id AND salon_id = _salon_id;

  -- Delete payments linked to those appointments
  IF v_appointment_ids IS NOT NULL AND array_length(v_appointment_ids, 1) > 0 THEN
    DELETE FROM public.payments
    WHERE appointment_id = ANY(v_appointment_ids) AND salon_id = _salon_id;
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;
  END IF;

  -- Delete appointments
  DELETE FROM public.appointments
  WHERE customer_id = _customer_id AND salon_id = _salon_id;
  GET DIAGNOSTICS v_deleted_appointments = ROW_COUNT;

  -- Collect installment IDs
  SELECT array_agg(id) INTO v_installment_ids
  FROM public.installments
  WHERE customer_id = _customer_id AND salon_id = _salon_id;

  -- Delete installment payments
  IF v_installment_ids IS NOT NULL AND array_length(v_installment_ids, 1) > 0 THEN
    DELETE FROM public.installment_payments
    WHERE installment_id = ANY(v_installment_ids) AND salon_id = _salon_id;
    GET DIAGNOSTICS v_deleted_installment_payments = ROW_COUNT;
  END IF;

  -- Delete installments
  DELETE FROM public.installments
  WHERE customer_id = _customer_id AND salon_id = _salon_id;
  GET DIAGNOSTICS v_deleted_installments = ROW_COUNT;

  -- Delete customer contracts (clear installment_id FK first)
  UPDATE public.customer_contracts
  SET installment_id = NULL
  WHERE customer_id = _customer_id AND salon_id = _salon_id;

  DELETE FROM public.customer_contracts
  WHERE customer_id = _customer_id AND salon_id = _salon_id;
  GET DIAGNOSTICS v_deleted_contracts = ROW_COUNT;

  -- Delete service sales
  DELETE FROM public.service_sales
  WHERE customer_id = _customer_id AND salon_id = _salon_id;
  GET DIAGNOSTICS v_deleted_service_sales = ROW_COUNT;

  -- Delete product sales
  DELETE FROM public.product_sales
  WHERE customer_id = _customer_id AND salon_id = _salon_id;
  GET DIAGNOSTICS v_deleted_product_sales = ROW_COUNT;

  -- Delete related cash_transactions (description contains customer name pattern)
  DELETE FROM public.cash_transactions
  WHERE salon_id = _salon_id
    AND description ILIKE '%' || v_customer_name || '%';
  GET DIAGNOSTICS v_deleted_cash_transactions = ROW_COUNT;

  -- Clear lead references
  UPDATE public.leads
  SET converted_customer_id = NULL
  WHERE converted_customer_id = _customer_id AND salon_id = _salon_id;

  -- Finally delete the customer
  DELETE FROM public.customers
  WHERE id = _customer_id AND salon_id = _salon_id;

  RETURN jsonb_build_object(
    'success', true,
    'customer_name', v_customer_name,
    'deleted_appointments', v_deleted_appointments,
    'deleted_payments', v_deleted_payments,
    'deleted_installments', v_deleted_installments,
    'deleted_installment_payments', v_deleted_installment_payments,
    'deleted_service_sales', v_deleted_service_sales,
    'deleted_product_sales', v_deleted_product_sales,
    'deleted_contracts', v_deleted_contracts,
    'deleted_cash_transactions', v_deleted_cash_transactions
  );
END;
$$;
