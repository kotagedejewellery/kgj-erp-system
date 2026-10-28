const SPV_CS_MENU_NAMES = new Set([
  "Dashboard",
  "Persetujuan",
  "Riwayat Order",
  "Riwayat Persetujuan",
]);

export function getSupervisorMenuItems<T extends { name: string }>(
  items: readonly T[],
  actualRole: string | null,
  isIntakeValidator: boolean,
): T[] {
  if (actualRole === "customer_service_supervisor" && isIntakeValidator) {
    return items.filter((item) => SPV_CS_MENU_NAMES.has(item.name));
  }
  if (actualRole === "production_supervisor") {
    return items.filter((item) => item.name !== "Slot Management");
  }
  return [...items];
}
