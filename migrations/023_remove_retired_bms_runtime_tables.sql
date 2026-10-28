BEGIN;

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'scan_events',
    'material_transactions',
    'order_stage_transitions',
    'stage_results',
    'cs_orders',
    'orders',
    'customers'
  ]
  LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
      FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = target_table
      LOOP
        EXECUTE format(
          'DROP POLICY IF EXISTS %I ON public.%I',
          policy_record.policyname,
          target_table
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_order_id_fkey;

DROP VIEW IF EXISTS public.v_stage_duration;
DROP VIEW IF EXISTS public.v_payment_status;

DROP TABLE IF EXISTS public.scan_events;
DROP TABLE IF EXISTS public.material_transactions;
DROP TABLE IF EXISTS public.order_stage_transitions;
DROP TABLE IF EXISTS public.stage_results;
DROP TABLE IF EXISTS public.cs_orders;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.customers;

COMMIT;
