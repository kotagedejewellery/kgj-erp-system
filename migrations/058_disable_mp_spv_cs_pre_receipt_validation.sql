UPDATE public.brand_intake_policies
SET
  requires_pre_receipt_validation = FALSE,
  updated_at = now()
WHERE brand_code = 'MP'
  AND requires_pre_receipt_validation = TRUE;
