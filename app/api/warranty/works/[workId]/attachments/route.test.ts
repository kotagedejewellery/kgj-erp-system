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

function profileQuery(profile: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.single.mockResolvedValue({ data: profile, error: null });
  return query;
}

function workQuery(work: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: work, error: null });
  return query;
}

describe("POST /api/warranty/works/[workId]/attachments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyimpan ID bukti kanonik pada Warranty Work aktif", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "worker-1" } } }) },
    });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "users") return profileQuery({ id: "worker-1", status: "active", role: { name: "qc_1", permissions: { "warranty.work.update": true } } });
        if (table === "warranty_works") return workQuery({ id: "work-1", claim_reference: "WCL-1", status: "qc", pic_id: "worker-other" });
        return { insert };
      }),
      rpc,
    });
    mocks.sendYiiWarrantyAttachment.mockResolvedValue({
      status: 201,
      error: null,
      body: { data: { id: 12, original_name: "bukti.png" } },
    });
    const file = { arrayBuffer: vi.fn(), name: "bukti.png", size: 5, type: "image/png" } as unknown as File;
    const response = await POST({ formData: vi.fn().mockResolvedValue({ get: vi.fn(() => file) }) } as unknown as Request, {
      params: Promise.resolve({ workId: "work-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.sendYiiWarrantyAttachment).toHaveBeenCalledWith("WCL-1", file);
    expect(rpc).toHaveBeenCalledWith("append_warranty_work_attachment", { p_work_id: "work-1", p_attachment_id: 12 });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: "WARRANTY_WORK_ATTACHMENT_UPLOADED", entity_id: "work-1" }));
  });
});
