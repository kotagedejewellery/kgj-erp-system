import { describe, expect, it } from "vitest";
import { getSupervisorMenuItems } from "@/lib/auth/supervisor-navigation";

const supervisorItems = [
  { name: "Dashboard", icon: "dashboard" },
  { name: "Persetujuan", icon: "approval" },
  { name: "Ketersediaan Stok", icon: "inventory" },
  { name: "Kelola Akun", icon: "users" },
  { name: "Personnel", icon: "personnel" },
  { name: "Slot Management", icon: "slot" },
  { name: "QR Code", icon: "qr" },
  { name: "Riwayat Order", icon: "order" },
  { name: "Riwayat Persetujuan", icon: "approval" },
  { name: "Garansi", icon: "warranty" },
];

describe("supervisor navigation", () => {
  it("does not expose the generic menu while the actual supervisor role is still loading", () => {
    expect(getSupervisorMenuItems(supervisorItems, null, false)).toEqual([]);
  });

  it("menampilkan menu khusus SPV CS tanpa menunggu data jaringan", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "customer_service_supervisor", true).map((item) => item.name),
    ).toEqual(["Dashboard", "Persetujuan", "Ketersediaan Stok", "Riwayat Order", "Riwayat Persetujuan"]);
  });

  it("menyembunyikan Slot Management untuk SPV Produksi", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "production_supervisor", false).map((item) => item.name),
    ).not.toContain("Slot Management");
    expect(
      getSupervisorMenuItems(supervisorItems, "production_supervisor", false).map((item) => item.name),
    ).not.toContain("Garansi");
  });

  it("mempertahankan menu SPV Operational", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "operational_supervisor", false).map((item) => item.name),
    ).toEqual(supervisorItems.map((item) => item.name));
  });

  it("menampilkan Ketersediaan Stok bagi semua jenis supervisor", () => {
    for (const role of ["customer_service_supervisor", "operational_supervisor", "production_supervisor"]) {
      expect(getSupervisorMenuItems(supervisorItems, role, role === "customer_service_supervisor").map((item) => item.name))
        .toContain("Ketersediaan Stok");
    }
  });
});
