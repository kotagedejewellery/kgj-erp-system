import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  ingestLegacyOrder: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/legacy/ingest", () => ({
  ingestLegacyOrder: mocks.ingestLegacyOrder,
}));

import { syncNewOrders } from "@/lib/legacy/sync-service";

describe("syncNewOrders", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    });
  });

  it("limits pull ingestion to five concurrent orders", async () => {
    let active = 0;
    let maxActive = 0;
    const processed: number[] = [];
    const orders = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      id,
      kode_order: `KGJ-${id}`,
      nama: "Test",
    }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders }),
    }));

    mocks.ingestLegacyOrder.mockImplementation(async (_db, order) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      processed.push(order.id);
      active--;
      return { action: "updated", stage: null, stageChanged: false };
    });

    const result = await syncNewOrders("2026-10-28 00:00:00");

    expect(maxActive).toBe(5);
    expect(result).toEqual({ synced: 0, skipped: 7, errors: 0 });
    expect(processed).toHaveLength(7);
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps processing remaining orders when one ingestion fails", async () => {
    const orders = [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      kode_order: `KGJ-${id}`,
      nama: "Test",
    }));
    const processed: number[] = [];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders }),
    }));
    mocks.ingestLegacyOrder.mockImplementation(async (_db, order) => {
      if (order.id === 3) throw new Error("gagal");
      processed.push(order.id);
      return { action: "updated", stage: null, stageChanged: false };
    });

    const result = await syncNewOrders("2026-10-28 00:00:00");

    expect(result).toEqual({ synced: 0, skipped: 5, errors: 1 });
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 6]);
  });
});
