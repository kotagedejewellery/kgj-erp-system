import { describe, expect, it } from "vitest";
import {
  buildStatusSyncJob,
  getStatusSyncRetryDelayMinutes,
} from "@/lib/legacy/push-status";

describe("buildStatusSyncJob", () => {
  it("uses the Yii2 legacy ID and mapped status for Persiapan Bahan", () => {
    expect(buildStatusSyncJob("erp-order-1", 5214, "racik_bahan")).toEqual({
      orderId: "erp-order-1",
      legacyId: 5214,
      stage: "racik_bahan",
      idStatus: 10,
    });
  });

  it("does not create a job when the Yii2 ID or stage mapping is unavailable", () => {
    expect(buildStatusSyncJob("erp-order-1", null, "racik_bahan")).toBeNull();
    expect(buildStatusSyncJob("erp-order-1", 5214, "unknown_stage")).toBeNull();
  });
});

describe("getStatusSyncRetryDelayMinutes", () => {
  it("backs off failed delivery attempts without exceeding six hours", () => {
    expect(getStatusSyncRetryDelayMinutes(1)).toBe(5);
    expect(getStatusSyncRetryDelayMinutes(2)).toBe(10);
    expect(getStatusSyncRetryDelayMinutes(10)).toBe(360);
  });
});
