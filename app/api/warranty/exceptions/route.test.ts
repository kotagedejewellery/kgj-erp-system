import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "./route";

function profileQuery(profile: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.single.mockResolvedValue({ data: profile, error: null });
  return query;
}

describe("POST /api/warranty/exceptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengantrekan keputusan SPV ke outbox, tanpa menghitung kuota lokal", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "spv-1", email: "spv@example.test" } }, error: null }) },
    });
    const rpc = vi.fn().mockResolvedValue({ data: [{ exception_request_id: "WER-1", status: "approved" }], error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({
        id: "spv-1", full_name: "SPV Operational", status: "active",
        role: { name: "operational_supervisor", permissions: { "warranty.exception.decide": true } },
      })),
      rpc,
    });

    const response = await POST(new Request("http://localhost/api/warranty/exceptions", {
      method: "POST",
      body: JSON.stringify({ exception_request_id: "WER-1", decision: "approved", reason: "Disetujui untuk kasus pelanggan ini" }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("decide_warranty_exception", expect.objectContaining({
      p_exception_request_id: "WER-1",
      p_actor_id: "spv-1",
      p_decision: "approved",
    }));
  });
});
