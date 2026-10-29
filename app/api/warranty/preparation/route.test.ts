import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET, POST } from "./route";

function query(result: unknown, onEq?: (field: string) => void) {
  const value = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  value.select.mockReturnValue(value);
  value.eq.mockImplementation((field: string) => {
    onEq?.(field);
    return value;
  });
  value.is.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.limit.mockReturnValue(value);
  value.in.mockReturnValue(value);
  value.maybeSingle.mockResolvedValue(result);
  value.single.mockResolvedValue(result);
  return value;
}

describe("POST /api/warranty/preparation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menolak akun nonaktif sebelum memproses Warranty Preparation", async () => {
    const userQuery = {
      select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn(),
    };
    userQuery.select.mockReturnValue(userQuery);
    userQuery.eq.mockReturnValue(userQuery);
    userQuery.is.mockReturnValue(userQuery);
    userQuery.single.mockResolvedValue({
      data: { id: "warranty-admin-1", status: "inactive", role: { name: "after_sales", permissions: { warranty_administrator: true } } },
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "warranty-admin-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => userQuery) });

    const response = await POST(new Request("http://localhost/api/warranty/preparation", { method: "POST", body: JSON.stringify({}) }));

    if (!response) throw new Error("Route tidak mengembalikan respons");
    expect(response.status).toBe(403);
  });

  it("menolak pengguna tanpa permission Warranty Administrator", async () => {
    const userQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      single: vi.fn(),
    };
    userQuery.select.mockReturnValue(userQuery);
    userQuery.eq.mockReturnValue(userQuery);
    userQuery.is.mockReturnValue(userQuery);
    userQuery.single.mockResolvedValue({
      data: { id: "user-1", status: "active", role: { name: "customer_service", permissions: {} } },
    });

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => userQuery) });

    const response = await POST(new Request("http://localhost/api/warranty/preparation", {
      method: "POST",
      body: JSON.stringify({ order_id: "order-1" }),
    }));

    if (!response) throw new Error("Route tidak mengembalikan respons");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("menolak berat awal nol sebelum menulis data", async () => {
    const userQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      single: vi.fn(),
    };
    userQuery.select.mockReturnValue(userQuery);
    userQuery.eq.mockReturnValue(userQuery);
    userQuery.is.mockReturnValue(userQuery);
    userQuery.single.mockResolvedValue({
      data: {
        id: "warranty-admin-1", status: "active",
        role: { name: "after_sales", permissions: { warranty_administrator: true } },
      },
    });

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "warranty-admin-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => userQuery) });

    const response = await POST(new Request("http://localhost/api/warranty/preparation", {
      method: "POST",
      body: JSON.stringify({
        order_id: "order-1",
        gender: "pria",
        starting_weight_gram: 0,
        plan_version_reference: "KGJ-12M-V1",
      }),
    }));

    if (!response) throw new Error("Route tidak mengembalikan respons");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "berat awal harus lebih dari 0" });
  });

  it("menolak Plan Version yang tidak sesuai brand dan matriks v1", async () => {
    const profile = query({
      data: {
        id: "warranty-admin-1", status: "active",
        role: { name: "after_sales", permissions: { warranty_administrator: true } },
      },
    });
    const order = query({ data: { id: "order-1", legacy_id: 123, kode_order: "KGJ-001", id_brand: 1 }, error: null });

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "warranty-admin-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "users" ? profile : order),
    });

    const response = await POST(new Request("http://localhost/api/warranty/preparation", {
      method: "POST",
      body: JSON.stringify({
        order_id: "order-1",
        gender: "pria",
        starting_weight_gram: 4.2,
        plan_version_reference: "HIJAZ-60M-V1",
      }),
    }));

    if (!response) throw new Error("Route tidak mengembalikan respons");
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Plan Version tidak berlaku untuk brand order" });
  });

  it("memuat Preparation untuk nomor order After Sales beserta command Candidate berdasarkan unit", async () => {
    const profile = query({
      data: {
        id: "warranty-admin-1", status: "active",
        role: { name: "after_sales", permissions: { warranty_administrator: true } },
      },
    });
    const order = query({ data: { id: "order-1", legacy_id: 123, kode_order: "KGJ-001", id_brand: 1 }, error: null });
    const tracking = query({ data: { current_stage: "selesai" }, error: null });
    const preparation = query({ data: { is_ready: true, ready_at: "2026-11-01T00:00:00Z" }, error: null });
    const units = query({
      data: [{ id: "unit-1", candidate_sequence: 1, unit_code: "RING-1", gender: "pria", starting_weight_gram: 4.2, plan_version_reference: "KGJ-12M-V1" }],
      error: null,
    });
    const outbox = query({ data: { event_id: "00000000-0000-4000-8000-000000000001", status: "delivered" }, error: null });
    const commands = query(
      { data: [{ unit_id: "unit-1", command: "validate", status: "completed", last_error: null }], error: null },
      (field) => {
        if (field === "order_id") throw new Error("column warranty_candidate_commands.order_id does not exist");
      },
    );
    const contracts = query({ data: [], error: null });

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "warranty-admin-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        users: profile,
        legacy_orders: order,
        tracking_stages: tracking,
        warranty_preparations: preparation,
        warranty_preparation_units: units,
        warranty_activation_outbox: outbox,
        warranty_candidate_commands: commands,
        warranty_contract_projections: contracts,
      })[table]),
    });

    const response = await GET(new Request("http://localhost/api/warranty/preparation?order_reference=KGJ-001"));

    if (!response) throw new Error("Route tidak mengembalikan respons");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.units[0].commands.validate.status).toBe("completed");
    expect(body.data.plan_options[0].value).toBe("KGJ-12M-V1");
    expect(body.data.order).toEqual({ id: "order-1", reference: "KGJ-001", current_stage: "selesai" });
    expect(order.eq).toHaveBeenCalledWith("kode_order", "KGJ-001");
  });
});
