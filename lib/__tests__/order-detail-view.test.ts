import { describe, expect, it } from "vitest";
import { getOrderDetailTabs } from "@/lib/orders/order-detail-view";

describe("order detail view", () => {
  it("hanya menampilkan informasi order untuk intake sebelum penerimaan", () => {
    expect(getOrderDetailTabs("intake")).toEqual(["info"]);
  });

  it("mempertahankan tab detail untuk order yang sudah masuk tracking", () => {
    expect(getOrderDetailTabs("tracking")).toEqual(["info", "stages", "approvals"]);
  });
});
