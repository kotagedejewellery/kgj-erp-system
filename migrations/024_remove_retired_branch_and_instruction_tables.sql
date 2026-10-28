BEGIN;

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['branches', 'work_instructions']
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

DROP POLICY IF EXISTS users_branch_admin_view ON public.users;
DROP POLICY IF EXISTS users_cs_view ON public.users;
DROP POLICY IF EXISTS activity_logs_branch_admin_view ON public.activity_logs;

ALTER TABLE IF EXISTS public.users
  DROP CONSTRAINT IF EXISTS users_branch_id_fkey;

ALTER TABLE IF EXISTS public.users
  DROP COLUMN IF EXISTS branch_id;

DROP TABLE IF EXISTS public.branches;
DROP TABLE IF EXISTS public.work_instructions;

COMMIT;
