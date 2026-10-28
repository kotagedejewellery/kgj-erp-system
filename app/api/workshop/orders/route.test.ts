import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getRoleProps: vi.fn(),
  legacyToOrderSummary: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/auth/session", () => ({
  getRoleProps: mocks.getRoleProps,
}));

vi.mock("@/lib/legacy/adapter", () => ({
  legacyToOrderSummary: mocks.legacyToOrderSummary,
}));

import { GET } from "./route";

describe("GET /api/workshop/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mencari sebelum mem-page hasil dan mengembalikan metadata halaman", async () => {
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
        id: "worker-1",
        role: {
          name: "pembentukan",
          role_group: "production",
          allowed_stages: ["pembentukan_cincin"],
        },
      },
    });

    const trackingQuery = {
      select: vi.fn(),
      neq: vi.fn(),
      order: vi.fn(),
      in: vi.fn(),
      range: vi.fn(),
    };
    trackingQuery.select.mockReturnValue(trackingQuery);
    trackingQuery.neq.mockReturnValue(trackingQuery);
    trackingQuery.order.mockReturnValue(trackingQuery);
    trackingQuery.in.mockReturnValue(trackingQuery);
    trackingQuery.range.mockResolvedValue({
      data: [
        {
          id: "tracking-1",
          order_id: "order-buhtiar",
          current_stage: "pembentukan_cincin",
        },
      ],
      count: 1,
      error: null,
    });

    const matchingOrdersQuery = {
      select: vi.fn(),
      or: vi.fn(),
    };
    matchingOrdersQuery.select.mockReturnValue(matchingOrdersQuery);
    matchingOrdersQuery.or.mockResolvedValue({
      data: [{ id: "order-buhtiar" }],
      error: null,
    });

    const orderQuery = {
      select: vi.fn(),
      in: vi.fn(),
    };
    orderQuery.select.mockReturnValue(orderQuery);
    orderQuery.in.mockResolvedValue({
      data: [{ id: "order-buhtiar", kode_order: "KGJ09265124" }],
      error: null,
    });

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "worker-1" } } }) },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "users") return userQuery;
        if (table === "tracking_stages") return trackingQuery;
        if (table === "legacy_orders") {
          return matchingOrdersQuery.or.mock.calls.length === 0
            ? matchingOrdersQuery
            : orderQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    mocks.getRoleProps.mockImplementation((user) => user.role);
    mocks.legacyToOrderSummary.mockReturnValue({
      id: "order-buhtiar",
      order_number: "KGJ09265124",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/workshop/orders?q=Buhtiar&limit=50&offset=0",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [{ id: "order-buhtiar", order_number: "KGJ09265124" }],
      total: 1,
      next_offset: null,
    });
    expect(trackingQuery.in).toHaveBeenNthCalledWith(
      2,
      "order_id",
      ["order-buhtiar"],
    );
    expect(trackingQuery.range).toHaveBeenCalledWith(0, 49);
  });
});
