import { describe, expect, it } from "vitest";
import {
  filterBottleneckStages,
  getBottleneckSearchResult,
} from "@/lib/bottleneck/search";
import type { StageBottleneck } from "@/types/bottleneck";

const stages: StageBottleneck[] = [
  {
    stage: "racik_bahan", stage_label: "Racik Bahan", stage_group: "production",
    order_count: 1, waiting_orders: 1, in_progress_orders: 0, avg_hours: 10, longest_hours: 10,
    orders: [{
      order_id: "order-1", order_number: "KGJ09260001", customer_name: "Alya",
      product_name: "Cincin Nikah", proses_produksi: "Kilat", hours_waiting: 10,
      status: "in_progress", current_stage: "racik_bahan", deadline: null,
      last_worker: null, approval_decision: null, approved_by: null,
    }],
  },
  {
    stage: "approval_penerimaan_order", stage_label: "Approval Penerimaan", stage_group: "approval",
    order_count: 1, waiting_orders: 1, in_progress_orders: 0, avg_hours: 4, longest_hours: 4,
    orders: [{
      order_id: "order-2", order_number: "MP09260002", customer_name: "Bima",
      product_name: "Cincin Couple", proses_produksi: "VVIP", hours_waiting: 4,
      status: "waiting_approval", current_stage: "approval_penerimaan_order", deadline: null,
      last_worker: null, approval_decision: null, approved_by: null,
    }],
  },
];

describe("bottleneck search", () => {
  it("mencari kode order, customer, produk, dan proses produksi", () => {
    expect(filterBottleneckStages(stages, "kgj0926")).toHaveLength(1);
    expect(filterBottleneckStages(stages, "bima")).toHaveLength(1);
    expect(filterBottleneckStages(stages, "couple")).toHaveLength(1);
    expect(filterBottleneckStages(stages, "vvip")).toHaveLength(1);
  });

  it("hanya menyisakan tahap dan detail order yang cocok", () => {
    const result = filterBottleneckStages(stages, "kilat");
    expect(result).toHaveLength(1);
    expect(result[0].stage).toBe("racik_bahan");
    expect(result[0].orders).toHaveLength(1);
  });

  it("mengembalikan total hasil bersama tahap yang telah difilter", () => {
    const result = getBottleneckSearchResult(stages, "cincin");

    expect(result.totalMatches).toBe(2);
    expect(result.stages).toHaveLength(2);
  });
});
