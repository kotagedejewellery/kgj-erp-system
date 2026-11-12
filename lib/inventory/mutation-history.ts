export type MutationHistoryRecord = {
  id: string;
  mutation_type: string;
  material_label: string | null;
  stock_unit_label: string | null;
  order_code: string | null;
  actor_name: string | null;
};

export const INVENTORY_MUTATION_LABELS: Record<string, string> = {
  opening: "Stok awal",
  receipt: "Penerimaan",
  adjustment: "Penyesuaian",
  issue_to_wip: "Keluar ke WIP",
  allocate_finished_good: "Alokasi cincin jadi",
  return_from_wip: "Retur dari WIP",
  return_to_stock: "Retur ke stok",
  scrap: "Scrap",
  transfer: "Pindah gudang",
  retire_finished_good: "Unit ready-stock dinonaktifkan",
};

export function isInventoryMutationType(value: string): boolean {
  return value in INVENTORY_MUTATION_LABELS;
}

export function inventoryMutationLabel(value: string): string {
  return INVENTORY_MUTATION_LABELS[value] ?? value;
}

export function formatMutationQuantity(value: number | string | null): string {
  if (value === null) return "Unit tanpa timbang";
  return `${Number(value).toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}

export function filterMutationHistory<T extends MutationHistoryRecord>(
  records: readonly T[],
  filters: { type: string; query: string },
): T[] {
  const query = filters.query.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.type && record.mutation_type !== filters.type) return false;
    if (!query) return true;
    return [record.material_label, record.stock_unit_label, record.order_code, record.actor_name]
      .some((value) => value?.toLowerCase().includes(query));
  });
}
