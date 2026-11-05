export function canManageInventory(status: string | null | undefined, roleName: string): boolean {
  return status === "active" && roleName === "management";
}
