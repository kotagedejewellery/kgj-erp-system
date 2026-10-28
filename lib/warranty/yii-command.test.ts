import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { createWarrantyMultipartSignature } from "./yii-command";

describe("Warranty multipart transport", () => {
  it("menandatangani metadata lampiran sesuai wire contract", () => {
    const expected = createHmac("sha256", "secret")
      .update("POST\n/api/warranty/v1/attachments\n2026-10-27T10:00:00Z\nmultipart\nWCL-1\nabc123\n8")
      .digest("hex");

    expect(createWarrantyMultipartSignature(
      "secret",
      "/api/warranty/v1/attachments",
      "2026-10-27T10:00:00Z",
      "WCL-1",
      "abc123",
      8,
    )).toBe(expected);
  });
});
