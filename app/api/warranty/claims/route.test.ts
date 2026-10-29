import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  sendYiiWarrantyCommand: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/warranty/yii-command", () => ({ sendYiiWarrantyCommand: mocks.sendYiiWarrantyCommand }));

import { POST } from "./route";

function profileQuery(profile: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.single.mockResolvedValue({ data: profile, error: null });
  return query;
}

describe("POST /api/warranty/claims", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan draft Claim dengan benefit_code kanonik Yii2", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1", email: "after@example.test" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({
        id: "after-sales-1", status: "active",
        full_name: "After Sales",
        role: { name: "after_sales", permissions: { "warranty.claim.create": true } },
      })),
    });
    mocks.sendYiiWarrantyCommand.mockResolvedValue({
      status: 201,
      error: null,
      body: { data: { reference: "WCL-1", claim_version: 1 } },
    });

    const response = await POST(new Request("http://localhost/api/warranty/claims", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        contract_reference: "WCT-1",
        benefit_code: "resize",
        condition_notes: "Ukuran perlu disesuaikan",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.sendYiiWarrantyCommand).toHaveBeenCalledWith(
      "/api/warranty/v1/commands/claim-drafts",
      expect.objectContaining({
        expected_version: null,
        data: {
          contract_reference: "WCT-1",
          benefit_code: "resize",
          condition_notes: "Ukuran perlu disesuaikan",
        },
      }),
    );
  });

  it("menolak operator tanpa permission command Claim", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({ id: "operator-1", status: "active", role: { name: "after_sales", permissions: {} } })),
    });

    const response = await POST(new Request("http://localhost/api/warranty/claims", {
      method: "POST",
      body: JSON.stringify({ action: "create", contract_reference: "WCT-1", benefit_code: "resize", condition_notes: "Catatan" }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.sendYiiWarrantyCommand).not.toHaveBeenCalled();
  });

  it("meneruskan pembatalan Claim dengan alasan dan versi kanonik", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1", email: "after@example.test" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({
        id: "after-sales-1", status: "active",
        full_name: "After Sales",
        role: { name: "after_sales", permissions: { "warranty.claim.cancel": true } },
      })),
    });
    mocks.sendYiiWarrantyCommand.mockResolvedValue({ status: 202, error: null, body: { data: { status: "cancellation_requested" } } });

    const response = await POST(new Request("http://localhost/api/warranty/claims", {
      method: "POST",
      body: JSON.stringify({
        action: "cancel",
        claim_reference: "WCL-1",
        expected_version: 3,
        reason: "Pelanggan membatalkan permintaan",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.sendYiiWarrantyCommand).toHaveBeenCalledWith(
      "/api/warranty/v1/commands/claims/cancel",
      expect.objectContaining({
        expected_version: 3,
        data: { claim_reference: "WCL-1", reason: "Pelanggan membatalkan permintaan" },
      }),
    );
  });

  it("menolak akun nonaktif sebelum meneruskan command Claim", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({
        id: "after-sales-1", status: "inactive",
        role: { name: "after_sales", permissions: { "warranty.claim.create": true } },
      })),
    });

    const response = await POST(new Request("http://localhost/api/warranty/claims", {
      method: "POST",
      body: JSON.stringify({ action: "create", contract_reference: "WCT-1", benefit_code: "resize", condition_notes: "Catatan" }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.sendYiiWarrantyCommand).not.toHaveBeenCalled();
  });
});
