const SPV_CS_MENU_NAMES = new Set([
  "Dashboard",
  "Persetujuan",
  "Riwayat Order",
  "Riwayat Persetujuan",
]);
const WARRANTY_MENU_NAMES = new Set(["Garansi", "Exception Garansi"]);

export function getSupervisorMenuItems<T extends { name: string }>(
  items: readonly T[],
  actualRole: string | null,
  isIntakeValidator: boolean,
): T[] {
  const roleItems = actualRole === "operational_supervisor"
    ? items
    : items.filter((item) => !WARRANTY_MENU_NAMES.has(item.name));

  if (actualRole === "customer_service_supervisor" && isIntakeValidator) {
    return roleItems.filter((item) => SPV_CS_MENU_NAMES.has(item.name));
  }
  if (actualRole === "production_supervisor") {
    return roleItems.filter((item) => item.name !== "Slot Management");
  }
  return [...roleItems];
}
