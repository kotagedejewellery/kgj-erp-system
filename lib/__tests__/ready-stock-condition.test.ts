import { describe, expect, it } from "vitest";
import { getReadyStockConditionOptions, isStandardReadyStockCondition, readyStockConditionLabel } from "@/lib/inventory/ready-stock-condition";

describe("ready-stock conditions", () => {
  it("uses a stable label for standard physical conditions", () => {
    expect(readyStockConditionLabel("good")).toBe("Baik");
    expect(readyStockConditionLabel("damaged")).toBe("Perlu perbaikan");
  });

  it("keeps a legacy condition selectable while adding standard choices", () => {
    expect(getReadyStockConditionOptions("minor-scratch")).toContainEqual({ value: "minor-scratch", label: "Kondisi lama: minor-scratch" });
    expect(isStandardReadyStockCondition("good")).toBe(true);
    expect(isStandardReadyStockCondition("minor-scratch")).toBe(false);
  });
});
