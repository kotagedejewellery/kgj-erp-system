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
