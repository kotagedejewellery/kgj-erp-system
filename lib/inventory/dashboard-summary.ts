type Location = {
  id: string;
  location_type: "warehouse" | "wip";
};

type MaterialBalance = {
  location_id: string;
  quantity_grams: number | string;
};

function grams(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildInventoryDashboardSummary(
  locations: Location[],
  balances: MaterialBalance[],
  availableStockUnits: number,
  materialCount: number,
) {
  const locationTypes = new Map(locations.map((location) => [location.id, location.location_type]));
  let warehouseGrams = 0;
  let wipGrams = 0;

  for (const balance of balances) {
    if (locationTypes.get(balance.location_id) === "warehouse") {
      warehouseGrams += grams(balance.quantity_grams);
    }
    if (locationTypes.get(balance.location_id) === "wip") {
      wipGrams += grams(balance.quantity_grams);
    }
  }

  return {
    warehouse_grams: Number(warehouseGrams.toFixed(3)),
    wip_grams: Number(wipGrams.toFixed(3)),
    available_stock_units: availableStockUnits,
    material_count: materialCount,
  };
}
