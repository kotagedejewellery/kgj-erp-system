import { describe, expect, it } from "vitest";
import { calculateWorkshopPulse } from "@/lib/workshop-pulse";

describe("calculateWorkshopPulse", () => {
  it("menghitung hanya order sumber aktif pada stage workshop yang tepat", () => {
    const result = calculateWorkshopPulse({
      today: "2026-09-21",
      todayStart: "2026-09-20T17:00:00.000Z",
      ordersReceived: 4,
      reworksLogged: 2,
      activeUserIds: ["operator-1", "operator-1", "spv-1", null],
      stages: [
        {
          current_stage: "selesai",
          updated_at: "2026-09-20T18:00:00.000Z",
          order: { deleted_at: null, tgl_selesai: "2026-09-18" },
        },
        {
          current_stage: "konfirmasi",
          updated_at: "2026-09-20T16:59:59.000Z",
          order: { deleted_at: null, tgl_selesai: "2026-09-21" },
        },
        {
          current_stage: "packing",
          updated_at: "2026-09-20T18:00:00.000Z",
          order: { deleted_at: null, tgl_selesai: "2026-09-21" },
        },
        {
          current_stage: "pengiriman",
          updated_at: "2026-09-20T18:00:00.000Z",
          order: { deleted_at: null, tgl_selesai: "2026-09-19" },
        },
        {
          current_stage: "racik_bahan",
          updated_at: "2026-09-20T18:00:00.000Z",
          order: { deleted_at: "2026-09-01T00:00:00.000Z", tgl_selesai: "2026-09-10" },
        },
      ],
    });

    expect(result.today).toEqual({
      ordersReceived: 4,
      ordersCompleted: 1,
      reworksLogged: 2,
      activeUsers: 2,
    });
    expect(result.workInProgress).toEqual({ activeOrders: 3, overdueOrders: 1 });
    expect(result.afterProduction).toEqual({
      customerCare: 1,
      packing: 1,
      shipping: 1,
    });
  });
});
