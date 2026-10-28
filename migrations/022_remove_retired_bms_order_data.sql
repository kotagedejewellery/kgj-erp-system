-- Retired BMS order-data cleanup
--
-- Scope: unused tables from the former cs_orders-based BMS model.
-- The active Yii2 / OPR-PRD workflow uses legacy_orders and its legacy_* tables.
-- No CASCADE is used: an unexpected dependency aborts the whole transaction.

BEGIN;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'handover_logs',
        'attachments',
        'packaging_logs',
        'completeness_checklist',
        'certificate_logs',
        'order_gemstones',
        'payments',
        'data_deletion_logs'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- handover_logs references attachments, so it must be removed first.
DROP TABLE IF EXISTS public.handover_logs RESTRICT;
DROP TABLE IF EXISTS public.attachments RESTRICT;
DROP TABLE IF EXISTS public.packaging_logs RESTRICT;
DROP TABLE IF EXISTS public.completeness_checklist RESTRICT;
DROP TABLE IF EXISTS public.certificate_logs RESTRICT;
DROP TABLE IF EXISTS public.order_gemstones RESTRICT;
DROP TABLE IF EXISTS public.payments RESTRICT;
DROP TABLE IF EXISTS public.data_deletion_logs RESTRICT;

COMMIT;
