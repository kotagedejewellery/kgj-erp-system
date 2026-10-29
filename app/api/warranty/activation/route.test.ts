import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "./route";

describe("POST /api/warranty/activation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menolak akun nonaktif sebelum memvalidasi atau mengaktifkan Candidate", async () => {
    const profile = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() };
    profile.select.mockReturnValue(profile);
    profile.eq.mockReturnValue(profile);
    profile.is.mockReturnValue(profile);
    profile.single.mockResolvedValue({
      data: { id: "after-sales-1", status: "inactive", role: { name: "after_sales", permissions: { "warranty.activation.validate": true } } },
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => profile) });

    const response = await POST(new Request("http://localhost/api/warranty/activation", {
      method: "POST",
      body: JSON.stringify({ order_id: "order-1", unit_id: "unit-1", action: "validate" }),
    }));

    expect(response.status).toBe(403);
  });
});
