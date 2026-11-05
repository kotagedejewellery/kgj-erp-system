import { describe, expect, it } from "vitest";
import { canAccessPath, getDashboardPath, isWorkshopRole } from "@/lib/routes";

describe("customer service supervisor role", () => {
  it("mengarah ke dashboard supervisor", () => {
    expect(getDashboardPath("customer_service_supervisor")).toBe(
      "/dashboard/supervisor/bottleneck",
    );
  });

  it("hanya dapat mengakses dashboard supervisor", () => {
    expect(
      canAccessPath(
        "customer_service_supervisor",
        "/dashboard/supervisor/approval",
      ),
    ).toBe(true);
    expect(
      canAccessPath(
        "customer_service_supervisor",
        "/dashboard/management",
      ),
    ).toBe(false);
  });
});

describe("retired dashboard roles", () => {
  it("does not give retired roles a dashboard or workshop access", () => {
    expect(getDashboardPath("customer_service")).toBeNull();
    expect(getDashboardPath("marketing")).toBeNull();
    expect(getDashboardPath("leader_operational")).toBeNull();
    expect(isWorkshopRole("customer_service")).toBe(false);
    expect(canAccessPath("marketing", "/workshop/input")).toBe(false);
    expect(canAccessPath("leader_operational", "/dashboard/management")).toBe(false);
  });
});

describe("after sales role", () => {
  it("masuk hanya ke workspace After Sales", () => {
    expect(getDashboardPath("after_sales")).toBe("/dashboard/after-sales/garansi");
    expect(canAccessPath("after_sales", "/dashboard/after-sales/garansi")).toBe(true);
    expect(canAccessPath("after_sales", "/dashboard/after-sales/aktivasi")).toBe(true);
    expect(canAccessPath("after_sales", "/dashboard/supervisor/approval")).toBe(false);
    expect(canAccessPath("operational_supervisor", "/dashboard/supervisor/warranty")).toBe(true);
    expect(canAccessPath("customer_service_supervisor", "/dashboard/supervisor/warranty")).toBe(false);
    expect(canAccessPath("production_supervisor", "/dashboard/supervisor/warranty")).toBe(false);
    expect(isWorkshopRole("after_sales")).toBe(false);
  });
});

describe("management inventory role", () => {
  it("masuk hanya ke workspace inventory", () => {
    expect(getDashboardPath("management")).toBe("/dashboard/management");
    expect(canAccessPath("management", "/dashboard/management")).toBe(true);
    expect(canAccessPath("management", "/dashboard/supervisor/approval")).toBe(false);
    expect(canAccessPath("management", "/dashboard/after-sales/garansi")).toBe(false);
  });
});
