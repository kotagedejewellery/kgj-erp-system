import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from "./route";

function queryResult(result: Record<string, unknown>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gt: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: Record<string, unknown>) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe("GET /api/warranty/after-sales-summary", () => {
  it("menolak sesi tanpa pengguna sebelum membaca ringkasan After Sales", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("menolak role selain After Sales dan Superadmin", async () => {
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { id: "supervisor-1", status: "active", role: { name: "operational_supervisor", permissions: {} } },
        error: null,
      }),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.is.mockReturnValue(profileQuery);
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "supervisor-1" } }, error: null }) } });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery) });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("menolak After Sales tanpa permission baca Contract dan Claim", async () => {
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { id: "after-sales-1", status: "active", role: { name: "after_sales", permissions: {} } },
        error: null,
      }),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.is.mockReturnValue(profileQuery);
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } }, error: null }) } });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery) });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("mengembalikan ringkasan dan antrean aktivasi untuk After Sales yang berizin", async () => {
    const profileQuery = queryResult({
      data: {
        id: "after-sales-1",
        status: "active",
        role: {
          name: "after_sales",
          permissions: { "warranty.contract.read": true, "warranty.claim.read": true },
        },
      },
      error: null,
    });
    const activationCount = queryResult({ count: 2, error: null });
    const activationQueue = queryResult({
      data: [{ status: "pending", updated_at: "2026-11-11T08:00:00.000Z", order: { kode_order: "KGJ-001" } }],
      error: null,
    });
    const contractCount = queryResult({ count: 4, error: null });
    const expiringCount = queryResult({ count: 1, error: null });
    const claimCount = queryResult({ count: 3, error: null });
    const lastInbound = queryResult({ data: { applied_at: "2026-11-11T09:00:00.000Z" }, error: null });
    const from = vi.fn((table: string) => {
      if (table === "users") return profileQuery;
      if (table === "warranty_contract_projections") return from.mock.calls.filter(([name]) => name === table).length === 1 ? contractCount : expiringCount;
      if (table === "warranty_activation_outbox") return from.mock.calls.filter(([name]) => name === table).length === 1 ? activationCount : activationQueue;
      if (table === "warranty_claim_projections") return claimCount;
      return lastInbound;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } }, error: null }) } });
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        active_contracts: 4,
        expiring_within_30_days: 1,
        pending_activations: 2,
        active_claims: 3,
        activation_queue: [{ order_reference: "KGJ-001", status: "pending", updated_at: "2026-11-11T08:00:00.000Z" }],
        last_synced_at: "2026-11-11T09:00:00.000Z",
      },
    });
  });

  it("mengembalikan error aman saat query ringkasan gagal", async () => {
    const profileQuery = queryResult({
      data: {
        id: "after-sales-1",
        status: "active",
        role: { name: "after_sales", permissions: { "warranty.contract.read": true, "warranty.claim.read": true } },
      },
      error: null,
    });
    const failedQuery = queryResult({ count: null, data: null, error: { message: "database unavailable" } });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "after-sales-1" } }, error: null }) } });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === "users" ? profileQuery : failedQuery) });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Ringkasan After Sales tidak dapat dimuat" });
  });
});
