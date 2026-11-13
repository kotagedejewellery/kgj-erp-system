ALTER TABLE public.inventory_materials
  ADD COLUMN IF NOT EXISTS material_family TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_materials_material_family_check'
  ) THEN
    ALTER TABLE public.inventory_materials
      ADD CONSTRAINT inventory_materials_material_family_check
      CHECK (material_family IS NULL OR material_family IN ('perak', 'palladium', 'emas_kuning', 'emas_putih', 'rosegold'));
  END IF;
END $$;
