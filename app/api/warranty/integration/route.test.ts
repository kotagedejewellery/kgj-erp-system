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

describe("POST /api/warranty/integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menolak Superadmin nonaktif sebelum menyentuh outbox", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({ id: "admin-1", status: "inactive", role: { name: "superadmin" } })),
    });

    const response = await POST(new Request("http://localhost/api/warranty/integration", {
      method: "POST",
      body: JSON.stringify({ action: "retry_outbox", source: "work", event_id: "00000000-0000-4000-8000-000000000001" }),
    }));

    expect(response.status).toBe(403);
  });

  it("mengantrekan ulang dead-letter tanpa membuat event baru", async () => {
    const outbox = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
    outbox.update.mockReturnValue(outbox);
    outbox.eq.mockReturnValue(outbox);
    outbox.select.mockReturnValue(outbox);
    outbox.maybeSingle.mockResolvedValue({ data: { event_id: "00000000-0000-4000-8000-000000000001" }, error: null });
    const audit = { insert: vi.fn().mockResolvedValue({ error: null }) };
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "users"
        ? profileQuery({ id: "admin-1", status: "active", role: { name: "superadmin" } })
        : table === "warranty_erp_outbox" ? outbox : audit),
    });

    const response = await POST(new Request("http://localhost/api/warranty/integration", {
      method: "POST",
      body: JSON.stringify({ action: "retry_outbox", source: "work", event_id: "00000000-0000-4000-8000-000000000001" }),
    }));

    expect(response.status).toBe(200);
    expect(outbox.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", attempt_count: 0 }));
    expect(outbox.eq).toHaveBeenCalledWith("event_id", "00000000-0000-4000-8000-000000000001");
  });
});
