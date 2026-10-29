import { createHash, createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "./route";

function signedRequest(body: string, timestamp: string) {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", "yii2-secret")
    .update(`POST\n/api/warranty/v1/events\n${timestamp}\n${bodyHash}`)
    .digest("hex");
  return new Request("http://localhost/api/warranty/v1/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-warranty-key-id": "yii2",
      "x-warranty-timestamp": timestamp,
      "x-warranty-signature": `v1=${signature}`,
    },
    body,
  });
}

describe("POST /api/warranty/v1/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WARRANTY_YII2_SECRET = "yii2-secret";
  });

  afterEach(() => {
    delete process.env.WARRANTY_YII2_SECRET;
  });

  it("menerima contract activation bertanda tangan dan meneruskannya ke inbox atomik", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "applied", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000001",
      event_type: "warranty_contract_activated",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      data: {
        contract_reference: "WCT-000001",
        unit_code: "RING-001",
        brand_code: "kgj",
        activated_at: "2026-10-27T00:00:00Z",
        expires_at: "2027-10-27T00:00:00Z",
      },
    };
    const body = JSON.stringify(event);

    const response = await POST(signedRequest(body, event.occurred_at));

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("apply_warranty_contract_activated", expect.objectContaining({
      p_source: "yii2",
      p_event_id: event.event_id,
      p_order_source_id: "123",
      p_contract_reference: "WCT-000001",
    }));
  });

  it("mengakui ulang event yang sudah ada tanpa membuat projection kedua", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "duplicate", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000002",
      event_type: "warranty_contract_activated",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      data: {
        contract_reference: "WCT-000001",
        unit_code: "RING-001",
        brand_code: "kgj",
        activated_at: "2026-10-27T00:00:00Z",
        expires_at: "2027-10-27T00:00:00Z",
      },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "duplicate" });
  });

  it("menerima perubahan Claim bertanda tangan dan memproyeksikan versi kanoniknya", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "applied", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000003",
      event_type: "warranty_claim_changed",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      claim_reference: "WCL-000001",
      data: {
        claim_version: 2,
        canonical_status: "verified_and_reserved",
        entitlement_snapshot: {
          quota_initial: 3,
          approved_grant: 0,
          quota_used: 0,
          quota_reserved: 1,
          quota_available: 2,
        },
      },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("apply_warranty_claim_changed", expect.objectContaining({
      p_source: "yii2",
      p_event_id: event.event_id,
      p_claim_reference: "WCL-000001",
      p_claim_version: 2,
      p_canonical_status: "verified_and_reserved",
      p_quota_available: 2,
    }));
  });

  it("menerima permintaan Warranty Work dan membuat satu Work idempoten", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "applied", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000004",
      event_type: "warranty_work_requested",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      claim_reference: "WCL-000001",
      data: {
        benefit_code: "RESIZE",
        condition_notes: "Ukuran perlu disesuaikan",
        requires_qc: true,
        requires_final_weight: true,
        requires_attachment: true,
      },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("apply_warranty_work_requested", expect.objectContaining({
      p_source: "yii2",
      p_event_id: event.event_id,
      p_claim_reference: "WCL-000001",
      p_benefit_code: "RESIZE",
      p_requires_qc: true,
    }));
  });

  it("menerima permintaan pembatalan Work dan meneruskannya ke inbox atomik", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "applied", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000005",
      event_type: "warranty_work_cancellation_requested",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      claim_reference: "WCL-000001",
      data: { work_reference: "WW-WCL-000001", reason: "Pelanggan membatalkan permintaan" },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("apply_warranty_work_cancellation_requested", expect.objectContaining({
      p_claim_reference: "WCL-000001",
      p_work_reference: "WW-WCL-000001",
    }));
  });

  it("menerima permintaan Exception untuk inbox SPV", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "applied", error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "00000000-0000-4000-8000-000000000006",
      event_type: "warranty_exception_requested",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      claim_reference: "WCL-000001",
      data: { exception_request_id: "WER-000001", reason: "Kasus khusus pelanggan" },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("apply_warranty_exception_requested", expect.objectContaining({
      p_exception_request_id: "WER-000001",
      p_claim_reference: "WCL-000001",
    }));
  });

  it("menolak event ID yang bukan UUID sebelum menyentuh inbox", async () => {
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ rpc });
    const event = {
      schema_version: 1,
      event_id: "bukan-uuid",
      event_type: "warranty_contract_activated",
      occurred_at: new Date().toISOString(),
      order: { source_id: "123", reference: "KGJ10260001" },
      data: {
        contract_reference: "WCT-000001",
        unit_code: "RING-001",
        brand_code: "kgj",
        activated_at: "2026-10-27T00:00:00Z",
        expires_at: "2027-10-27T00:00:00Z",
      },
    };

    const response = await POST(signedRequest(JSON.stringify(event), event.occurred_at));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
