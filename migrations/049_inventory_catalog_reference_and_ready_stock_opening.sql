-- Forward-only catalog reference and audited ready-stock opening.
-- This does not change legacy orders, workflow stages, approval, or inventory issue rules.

CREATE TABLE IF NOT EXISTS public.inventory_catalog_categories (
  source_system VARCHAR(20) NOT NULL DEFAULT 'yii2',
  source_category_id INTEGER NOT NULL CHECK (source_category_id > 0),
  name VARCHAR(160) NOT NULL,
  image_url TEXT,
  source_available BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_category_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_catalog_products (
  source_system VARCHAR(20) NOT NULL DEFAULT 'yii2',
  source_product_id INTEGER NOT NULL CHECK (source_product_id > 0),
  sku VARCHAR(120),
  name VARCHAR(255) NOT NULL,
  is_published BOOLEAN NOT NULL,
  legacy_primary_category_id INTEGER,
  category_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(category_ids) = 'array'),
  cover_image_url TEXT,
  source_available BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_product_id)
);

CREATE INDEX IF NOT EXISTS inventory_catalog_products_available_lookup
  ON public.inventory_catalog_products (source_system, source_available, is_published, name);

ALTER TABLE public.inventory_stock_units
  ADD COLUMN IF NOT EXISTS catalog_product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_product_sku VARCHAR(120),
  ADD COLUMN IF NOT EXISTS catalog_cover_image_url TEXT;

ALTER TABLE public.inventory_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_catalog_products ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.inventory_record_ready_stock_opening(
  p_unit_code TEXT,
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_size TEXT,
  p_material_description TEXT,
  p_actual_weight_grams NUMERIC,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stock_unit_id UUID;
  v_catalog_name VARCHAR(255);
  v_catalog_sku VARCHAR(120);
  v_catalog_cover_image_url TEXT;
BEGIN
  IF NULLIF(BTRIM(p_unit_code), '') IS NULL
    OR p_brand_id IS NULL OR p_brand_id <= 0
    OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_size), '') IS NULL
    OR NULLIF(BTRIM(p_material_description), '') IS NULL
    OR p_actual_weight_grams IS NULL OR p_actual_weight_grams <= 0
  THEN
    RAISE EXCEPTION 'inventory_ready_stock_opening_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_locations
    WHERE id = p_location_id AND location_type = 'warehouse' AND is_active
  ) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_materials
    WHERE source_material_id = p_source_material_id AND is_active
  ) THEN
    RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing';
  END IF;

  SELECT name, sku, cover_image_url
  INTO v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  FROM public.inventory_catalog_products
  WHERE source_system = 'yii2'
    AND source_product_id = p_source_product_id
    AND source_available
    AND is_published;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing';
  END IF;

  INSERT INTO public.inventory_stock_units (
    unit_code, brand_id, source_product_id, source_material_id, location_id,
    size, material_description, actual_weight_grams,
    catalog_product_name, catalog_product_sku, catalog_cover_image_url
  ) VALUES (
    UPPER(BTRIM(p_unit_code)), p_brand_id, p_source_product_id, p_source_material_id, p_location_id,
    BTRIM(p_size), BTRIM(p_material_description), p_actual_weight_grams,
    v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  )
  RETURNING id INTO v_stock_unit_id;

  INSERT INTO public.inventory_mutations (
    mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by
  ) VALUES (
    'opening', v_stock_unit_id, p_actual_weight_grams, p_location_id,
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'Stok awal ready-stock'), p_actor_id
  );

  RETURN v_stock_unit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_record_ready_stock_opening(
  TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_record_ready_stock_opening(
  TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT
) TO service_role;
