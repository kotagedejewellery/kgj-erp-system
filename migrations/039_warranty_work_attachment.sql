CREATE OR REPLACE FUNCTION public.append_warranty_work_attachment(
  p_work_id UUID,
  p_attachment_id JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result_attachment_ids JSONB;
BEGIN
  UPDATE public.warranty_works
  SET attachment_ids = attachment_ids || jsonb_build_array(p_attachment_id),
      updated_at = now()
  WHERE id = p_work_id
    AND status IN ('requested', 'in_progress', 'qc', 'cancellation_requested')
  RETURNING warranty_works.attachment_ids INTO result_attachment_ids;
  IF result_attachment_ids IS NULL THEN RAISE EXCEPTION 'warranty_work_not_active'; END IF;
  RETURN result_attachment_ids;
END;
$$;
