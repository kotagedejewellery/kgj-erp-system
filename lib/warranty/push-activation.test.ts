import { createHash, createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  createWarrantySignature,
  getWarrantyRetryDelayMs,
} from "./push-activation";

describe("Warranty activation delivery", () => {
  it("menandatangani body JSON dengan canonical HMAC wire contract", () => {
    const body = '{"event_id":"evt-1"}';
    const timestamp = "2026-10-27T10:00:00.000Z";
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const expected = createHmac("sha256", "secret")
      .update(`POST\n/api/warranty/v1/events\n${timestamp}\n${bodyHash}`)
      .digest("hex");

    expect(createWarrantySignature("secret", timestamp, body)).toBe(expected);
  });

  it("mengikuti jadwal retry event yang dibekukan pada kontrak", () => {
    expect(getWarrantyRetryDelayMs(1)).toBe(30_000);
    expect(getWarrantyRetryDelayMs(7)).toBe(32 * 60_000);
    expect(getWarrantyRetryDelayMs(8)).toBe(60 * 60_000);
  });
});
