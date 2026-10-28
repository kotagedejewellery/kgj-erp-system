-- Retired feature table cleanup
--
-- Scope: tables for features removed from Main-ERP source:
-- CS/Marketing dashboard, public Order Form, Slots, legacy BMS reports,
-- and unused Cekat persistence tables.
--
-- This migration intentionally does not use CASCADE. PostgreSQL will reject
-- the transaction if a non-target table still depends on any table below.
-- Run manually in Supabase SQL Editor only after reviewing the target list.

BEGIN;

-- Remove RLS policies attached to retired tables first. One legacy policy on
-- cs_inputs still references marketing_inputs, so PostgreSQL otherwise blocks
-- the first drop. Policies on non-target tables are intentionally untouched.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'slot_overrides',
        'slot_categories',
        'marketing_inputs',
        'cs_inputs',
        'marketing_channels',
        'reports',
        'customer_confirmations',
        'approvals',
        'quality_checklist_results',
        'rework_logs',
        'deliveries',
        'cekat_webhook_events',
        'cekat_conversations'
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

-- Slots
DROP TABLE IF EXISTS public.slot_overrides RESTRICT;
DROP TABLE IF EXISTS public.slot_categories RESTRICT;

-- Retired CS and Marketing dashboards
DROP TABLE IF EXISTS public.marketing_inputs RESTRICT;
DROP TABLE IF EXISTS public.cs_inputs RESTRICT;
DROP TABLE IF EXISTS public.marketing_channels RESTRICT;

-- Retired BMS-only records
DROP TABLE IF EXISTS public.reports RESTRICT;
DROP TABLE IF EXISTS public.customer_confirmations RESTRICT;
DROP TABLE IF EXISTS public.approvals RESTRICT;
DROP VIEW IF EXISTS public.v_quality_summary RESTRICT;
DROP TABLE IF EXISTS public.quality_checklist_results RESTRICT;
DROP TABLE IF EXISTS public.rework_logs RESTRICT;
DROP TABLE IF EXISTS public.deliveries RESTRICT;

-- Cekat persistence tables are unused by the current source.
DROP TABLE IF EXISTS public.cekat_webhook_events RESTRICT;
DROP TABLE IF EXISTS public.cekat_conversations RESTRICT;

COMMIT;
