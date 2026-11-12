import { describe, expect, it } from "vitest";
import { formatMutationQuantity } from "@/lib/inventory/mutation-history";

describe("formatMutationQuantity", () => {
  it("labels a ready-stock mutation without a measured weight honestly", () => {
    expect(formatMutationQuantity(null)).toBe("Unit tanpa timbang");
    expect(formatMutationQuantity("8.25")).toBe("8,250 g");
  });
});
