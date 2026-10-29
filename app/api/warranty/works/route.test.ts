import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

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

function workQuery(work: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({ data: work, error: null });
  return query;
}

describe("POST /api/warranty/works", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menetapkan PIC dan mengantrekan event ketika pekerja memulai Warranty Work", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "worker-1" } } }) },
    });
    const rpc = vi.fn().mockResolvedValue({ data: [{ status: "in_progress" }], error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "users"
        ? profileQuery({ id: "worker-1", status: "active", role: { name: "jewelry_expert_poles", permissions: { "warranty.work.update": true } } })
        : workQuery({ id: "work-1", status: "requested", pic_id: null })),
      rpc,
    });

    const response = await POST(new Request("http://localhost/api/warranty/works", {
      method: "POST",
      body: JSON.stringify({ work_id: "work-1", action: "start" }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("enqueue_warranty_work_update", expect.objectContaining({
      p_work_id: "work-1",
      p_actor_id: "worker-1",
      p_status: "in_progress",
      p_pic_id: "worker-1",
    }));
  });

  it("menolak SPV tanpa permission pembaruan Warranty Work", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "spv-1" } } }) },
    });
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => profileQuery({ id: "spv-1", status: "active", role: { name: "operational_supervisor", permissions: {} } })),
      rpc,
    });

    const response = await POST(new Request("http://localhost/api/warranty/works", {
      method: "POST",
      body: JSON.stringify({ work_id: "work-1", action: "start" }),
    }));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
