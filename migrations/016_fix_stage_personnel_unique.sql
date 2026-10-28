-- ============================================================
-- 016_fix_stage_personnel_unique.sql
-- Drops UNIQUE constraint on stage_personnel so users can have
-- multiple person_codes per stage+sub_type (e.g. laser:batik
-- can have EF, PR, RZ for the same user).
-- Dedup enforced at application level (person_code unique per
-- user+stage+sub_type).
-- ============================================================

ALTER TABLE public.stage_personnel
  DROP CONSTRAINT IF EXISTS stage_personnel_user_id_stage_sub_type_key;

ALTER TABLE public.stage_personnel
  DROP CONSTRAINT IF EXISTS stage_personnel_user_id_stage_key;

ALTER TABLE public.stage_personnel
  ADD UNIQUE(user_id, stage, sub_type);
