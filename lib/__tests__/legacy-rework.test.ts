import { describe, expect, it } from "vitest";
import { buildReworkRequestPayload } from "@/lib/legacy/push-rework";

describe("rework request payload", () => {
  it("mengirim permintaan revisi tanpa status atau stage produksi", () => {
    expect(buildReworkRequestPayload({
      intakeId: "intake-1",
      legacyId: 123,
      kodeOrder: "MPM09265377",
      requestId: "request-1",
      reason: "Ukiran perlu dikoreksi",
      requestedAt: "2026-10-05T07:30:00.000Z",
    })).toEqual({
      event: "spv_cs_rework_requested",
      request_id: "request-1",
      order_id: 123,
      kode_order: "MPM09265377",
      reason: "Ukiran perlu dikoreksi",
      requested_at: "2026-10-05T07:30:00.000Z",
    });
  });
});
