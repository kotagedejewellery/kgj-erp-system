import { describe, expect, it } from "vitest";
import { getSupervisorMenuItems } from "@/lib/auth/supervisor-navigation";

const supervisorItems = [
  { name: "Dashboard", icon: "dashboard" },
  { name: "Persetujuan", icon: "approval" },
  { name: "Kelola Akun", icon: "users" },
  { name: "Personnel", icon: "personnel" },
  { name: "Slot Management", icon: "slot" },
  { name: "QR Code", icon: "qr" },
  { name: "Riwayat Order", icon: "order" },
  { name: "Riwayat Persetujuan", icon: "approval" },
];

describe("supervisor navigation", () => {
  it("menampilkan menu khusus SPV CS tanpa menunggu data jaringan", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "customer_service_supervisor", true).map((item) => item.name),
    ).toEqual(["Dashboard", "Persetujuan", "Riwayat Order", "Riwayat Persetujuan"]);
  });

  it("menyembunyikan Slot Management untuk SPV Produksi", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "production_supervisor", false).map((item) => item.name),
    ).not.toContain("Slot Management");
  });

  it("mempertahankan menu SPV Operational", () => {
    expect(
      getSupervisorMenuItems(supervisorItems, "operational_supervisor", false).map((item) => item.name),
    ).toEqual(supervisorItems.map((item) => item.name));
  });
});
