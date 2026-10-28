import { describe, expect, it } from "vitest";
import {
  BRAND_FILTER_OPTIONS,
  getBrandDisplayName,
  getBrandIdFromFilterCode,
  getBrandFilterCode,
} from "@/lib/legacy/brands";

describe("legacy brand display names", () => {
  it("menampilkan id_brand 3 dari payload Yii2 sebagai MPM", () => {
    expect(getBrandDisplayName(3)).toBe("MPM");
  });

  it("menormalisasi prefix MPM ke kode filter MP", () => {
    expect(BRAND_FILTER_OPTIONS).toContainEqual({ value: "MP", label: "MPM" });
    expect(getBrandFilterCode("MPM10265510")).toBe("MP");
  });

  it("mempertahankan kode filter KGJ dan Hijaz", () => {
    expect(getBrandFilterCode("KGJ09265124")).toBe("KGJ");
    expect(getBrandFilterCode("HJZ09265206")).toBe("HJZ");
  });

  it("memetakan kode filter ke id brand Yii2", () => {
    expect(getBrandIdFromFilterCode("KGJ")).toBe(1);
    expect(getBrandIdFromFilterCode("HJZ")).toBe(2);
    expect(getBrandIdFromFilterCode("MP")).toBe(3);
    expect(getBrandIdFromFilterCode("invalid")).toBeNull();
  });
});
