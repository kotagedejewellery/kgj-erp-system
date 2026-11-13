-- Read-only model gallery for the Inventory dashboard. It aggregates physical units
-- without changing stock, allocation, order, stage, approval, or legacy sync data.

CREATE OR REPLACE FUNCTION public.inventory_ready_stock_model_gallery(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 12,
  p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  source_product_id INTEGER,
  brand_id INTEGER,
  label TEXT,
  cover_image_url TEXT,
  available_units BIGINT,
  allocated_units BIGINT,
  inspection_units BIGINT,
  total_units BIGINT,
  allocation_count BIGINT,
  variations JSONB,
  total_models BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH allocation_counts AS (
  SELECT stock_unit_id, COUNT(*)::BIGINT AS allocation_count
  FROM public.inventory_mutations
  WHERE mutation_type = 'allocate_finished_good'
  GROUP BY stock_unit_id
), variations AS (
  SELECT
    unit.source_product_id,
    unit.brand_id,
    unit.source_material_id,
    unit.location_id,
    unit.size,
    MAX(unit.material_description) AS material_description,
    unit.condition,
    COALESCE(unit.ring_gender, 'unspecified') AS ring_gender,
    MAX(COALESCE(catalog.sku, unit.catalog_product_sku)) AS catalog_sku,
    MAX(COALESCE(catalog.name, unit.catalog_product_name)) AS catalog_name,
    MAX(COALESCE(catalog.cover_image_url, unit.catalog_cover_image_url)) AS catalog_cover_image_url,
    COUNT(*) FILTER (WHERE unit.status = 'available')::BIGINT AS available_units,
    COUNT(*) FILTER (WHERE unit.status = 'allocated')::BIGINT AS allocated_units,
    COUNT(*) FILTER (WHERE unit.status = 'inspection')::BIGINT AS inspection_units,
    COUNT(*)::BIGINT AS total_units,
    COALESCE(SUM(allocation_counts.allocation_count), 0)::BIGINT AS allocation_count
  FROM public.inventory_stock_units unit
  LEFT JOIN public.inventory_catalog_products catalog
    ON catalog.source_system = 'yii2'
   AND catalog.source_product_id = unit.source_product_id
  LEFT JOIN allocation_counts ON allocation_counts.stock_unit_id = unit.id
  WHERE unit.source_product_id IS NOT NULL
    AND unit.status <> 'retired'
  GROUP BY
    unit.source_product_id,
    unit.brand_id,
    unit.source_material_id,
    unit.location_id,
    unit.size,
    unit.condition,
    COALESCE(unit.ring_gender, 'unspecified')
), models AS (
  SELECT
    source_product_id,
    brand_id,
    CASE
      WHEN NULLIF(MAX(catalog_sku), '') IS NULL THEN MAX(catalog_name)
      ELSE MAX(catalog_sku) || ' — ' || MAX(catalog_name)
    END AS label,
    MAX(catalog_cover_image_url) AS cover_image_url,
    SUM(available_units)::BIGINT AS available_units,
    SUM(allocated_units)::BIGINT AS allocated_units,
    SUM(inspection_units)::BIGINT AS inspection_units,
    SUM(total_units)::BIGINT AS total_units,
    SUM(allocation_count)::BIGINT AS allocation_count,
    JSONB_AGG(JSONB_BUILD_OBJECT(
      'source_product_id', source_product_id,
      'brand_id', brand_id,
      'source_material_id', source_material_id,
      'location_id', location_id,
      'size', size,
      'material_description', material_description,
      'condition', condition,
      'ring_gender', ring_gender,
      'available_units', available_units,
      'allocated_units', allocated_units,
      'inspection_units', inspection_units,
      'total_units', total_units,
      'allocation_count', allocation_count
    ) ORDER BY size NULLS LAST, material_description NULLS LAST, ring_gender) AS variations
  FROM variations
  GROUP BY source_product_id, brand_id
  HAVING MAX(catalog_name) IS NOT NULL
), filtered AS (
  SELECT *, COUNT(*) OVER()::BIGINT AS total_models
  FROM models
  WHERE NULLIF(BTRIM(p_query), '') IS NULL
    OR label ILIKE '%' || BTRIM(p_query) || '%'
)
SELECT
  source_product_id,
  brand_id,
  label,
  cover_image_url,
  available_units,
  allocated_units,
  inspection_units,
  total_units,
  allocation_count,
  variations,
  total_models
FROM filtered
ORDER BY allocation_count DESC, label
LIMIT LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 24)
OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 24);
$$;

REVOKE ALL ON FUNCTION public.inventory_ready_stock_model_gallery(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_ready_stock_model_gallery(INTEGER, INTEGER, TEXT) TO service_role;
