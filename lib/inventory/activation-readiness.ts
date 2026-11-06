import { isInventoryEnabled } from "@/lib/inventory/is-enabled";

type Location = {
  id: string;
  location_type: string;
  is_default: boolean;
  is_active: boolean;
};

type Material = {
  id: string;
  source_material_id: number | null;
  is_active: boolean;
};

type Balance = {
  location_id: string;
  material_id: string;
  quantity_grams: number | string;
};

export function isInventoryReadyForActivation(
  locations: Location[],
  materials: Material[],
  balances: Balance[],
): boolean {
  if (!isInventoryEnabled(true, locations)) return false;

  const warehouseIds = new Set(
    locations
      .filter((location) => location.location_type === "warehouse" && location.is_default && location.is_active)
      .map((location) => location.id),
  );

  return materials.some((material) =>
    material.is_active &&
    material.source_material_id !== null &&
    balances.some((balance) =>
      balance.material_id === material.id &&
      warehouseIds.has(balance.location_id) &&
      Number(balance.quantity_grams) > 0,
    ),
  );
}

export function buildInventoryActivationChecklist(
  locations: Location[],
  materials: Material[],
  balances: Balance[],
  catalogModelCount: number,
  readyStockUnitCount: number,
) {
  const hasDefaultLocation = (locationType: string) => locations.some((location) =>
    location.location_type === locationType && location.is_default && location.is_active,
  );
  const hasMappedMaterialWithStock = materials.some((material) =>
    material.is_active &&
    material.source_material_id !== null &&
    balances.some((balance) =>
      balance.material_id === material.id &&
      locations.some((location) =>
        location.id === balance.location_id &&
        location.location_type === "warehouse" &&
        location.is_default &&
        location.is_active &&
        Number(balance.quantity_grams) > 0,
      ),
    ),
  );

  return {
    has_default_warehouse: hasDefaultLocation("warehouse"),
    has_default_wip: hasDefaultLocation("wip"),
    has_mapped_material_with_stock: hasMappedMaterialWithStock,
    catalog_model_count: catalogModelCount,
    ready_stock_unit_count: readyStockUnitCount,
    can_activate: isInventoryReadyForActivation(locations, materials, balances),
  };
}
