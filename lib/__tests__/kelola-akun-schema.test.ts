import { describe, expect, it } from "vitest";
import { BmsUserSchema, SupervisorUserSchema } from "@/lib/schemas/kelola-akun";

describe("supervisor account schema", () => {
  it("menerima role supervisor customer service", () => {
    expect(
      SupervisorUserSchema.safeParse({
        username: "spv.cs",
        full_name: "SPV Customer Service",
        email: "spv.cs@example.com",
        password: "rahasia-aman",
        role: "customer_service_supervisor",
      }).success,
    ).toBe(true);
  });
});

describe("retired BMS account roles", () => {
  const baseAccount = {
    full_name: "Admin ERP",
    email: "admin@example.com",
    password: "rahasia-aman",
  };

  it("mengizinkan akun dashboard yang aktif", () => {
    expect(BmsUserSchema.safeParse({ ...baseAccount, role: "superadmin" }).success).toBe(true);
    expect(BmsUserSchema.safeParse({ ...baseAccount, role: "after_sales" }).success).toBe(true);
    expect(BmsUserSchema.safeParse({ ...baseAccount, role: "customer_service" }).success).toBe(false);
    expect(BmsUserSchema.safeParse({ ...baseAccount, role: "marketing" }).success).toBe(false);
  });
});
