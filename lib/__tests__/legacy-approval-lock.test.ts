import { describe, expect, it } from "vitest";
import { buildApprovalLockPayload } from "@/lib/legacy/push-approval-lock";

describe("approval lock payload", () => {
  it("mengunci order tanpa mengirim perubahan stage atau status", () => {
    expect(buildApprovalLockPayload({
      orderId: "order-1",
      legacyId: 123,
      kodeOrder: "MPM09265377",
      approvedAt: "2026-10-07T07:30:00.000Z",
    })).toEqual({
      event: "spv_cs_approved_lock",
      order_id: 123,
      kode_order: "MPM09265377",
      approved_at: "2026-10-07T07:30:00.000Z",
    });
  });
});
