import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  sendYiiWarrantyAttachment: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/warranty/yii-command", () => ({ sendYiiWarrantyAttachment: mocks.sendYiiWarrantyAttachment }));

import { POST } from "./route";

describe("POST /api/warranty/claims/[reference]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mencatat operator setelah lampiran kanonik berhasil disimpan", async () => {
    const profile = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() };
    profile.select.mockReturnValue(profile);
    profile.eq.mockReturnValue(profile);
    profile.is.mockReturnValue(profile);
    profile.single.mockResolvedValue({
      data: { id: "after-sales-1", role: { name: "after_sales", permissions: { "warranty.claim.complete_non_workshop": true } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "users" ? profile : { insert }),
    });
    mocks.sendYiiWarrantyAttachment.mockResolvedValue({
      status: 201,
      error: null,
      body: { data: { id: 12, original_name: "bukti.png" } },
    });
    const file = { arrayBuffer: vi.fn(), name: "bukti.png", size: 5, type: "image/png" } as unknown as File;
    const response = await POST({ formData: vi.fn().mockResolvedValue({ get: vi.fn(() => file) }) } as unknown as Request, {
      params: Promise.resolve({ reference: "WCL-1" }),
    });

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "after-sales-1",
      action: "WARRANTY_CLAIM_ATTACHMENT_UPLOADED",
      entity_type: "warranty_claim",
      entity_id: "WCL-1",
    }));
  });
});
