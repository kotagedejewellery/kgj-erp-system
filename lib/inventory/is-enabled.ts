type InventoryLocation = {
  location_type: string;
  is_default: boolean;
  is_active: boolean;
};

export function isInventoryEnabled(enabled: boolean, locations: InventoryLocation[]): boolean {
  if (!enabled) return false;
  return ["warehouse", "wip"].every((locationType) =>
    locations.some((location) =>
      location.location_type === locationType && location.is_default && location.is_active,
    ),
  );
}
