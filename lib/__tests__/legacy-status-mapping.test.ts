import { describe, expect, it } from "vitest";
import { STAGE_TO_YII2_STATUS, stageToYii2Status } from "@/lib/legacy/reverse-map";
import { mapStatusToStage, YII2_STATUS_TO_STAGE } from "@/lib/legacy/status";

const WORKFLOW_MAPPING: Record<string, number> = {
  penerimaan_order: 9,
  approval_penerimaan_order: 35,
  racik_bahan: 10,
  approval_racik_bahan: 36,
  lebur_bahan: 37,
  pembentukan_cincin: 12,
  pemasangan_permata: 38,
  pemolesan: 39,
  cek_kadar: 40,
  qc_1: 41,
  approval_qc_1: 42,
  laser: 43,
  finishing: 24,
  approval_produksi: 44,
  qc_2: 45,
  approval_qc_2: 46,
  konfirmasi: 47,
  packing: 48,
  pengiriman: 14,
  selesai: 15,
};

describe("Yii2 production status mapping", () => {
  it("maps every workflow stage to its verified Yii2 status", () => {
    expect(STAGE_TO_YII2_STATUS).toMatchObject(WORKFLOW_MAPPING);
    for (const [stage, status] of Object.entries(WORKFLOW_MAPPING)) {
      expect(stageToYii2Status(stage)).toBe(status);
      expect(mapStatusToStage(status)).toBe(stage);
    }
  });

  it("never treats Yii2 test status 34 as a production stage", () => {
    expect(YII2_STATUS_TO_STAGE).not.toHaveProperty("34");
    expect(Object.values(STAGE_TO_YII2_STATUS)).not.toContain(34);
  });

  it("keeps cancellation as the explicit terminal outbound status", () => {
    expect(stageToYii2Status("dibatalkan")).toBe(20);
  });
});
