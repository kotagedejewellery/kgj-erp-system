import { describe, expect, it } from "vitest";
import {
  buildOrderAvailability,
  canReadInventoryAvailability,
} from "@/lib/inventory/availability";

describe("inventory availability", () => {
  it("gives active supervisors read-only inventory access without granting management access", () => {
    expect(canReadInventoryAvailability("active", "customer_service_supervisor")).toBe(true);
    expect(canReadInventoryAvailability("active", "operational_supervisor")).toBe(true);
    expect(canReadInventoryAvailability("active", "production_supervisor")).toBe(true);
    expect(canReadInventoryAvailability("active", "management")).toBe(true);
    expect(canReadInventoryAvailability("inactive", "operational_supervisor")).toBe(false);
    expect(canReadInventoryAvailability("active", "production_staff")).toBe(false);
  });

  it("reports custom material and compatible ready-stock independently for the same order", () => {
    const result = buildOrderAvailability({
      order: {
        brandId: 1,
        productId: 99,
        components: [{ id_gender: 1, id_jenis_bahan: 5, ukuran: "17" }],
        beratCincinPria: "4.500",
        beratCincinWanita: null,
      },
      materials: [{ id: "gold", code: "EMAS-75", name: "Emas 75%", sourceMaterialId: 5, wastePercent: 10 }],
      balances: [{ materialId: "gold", quantityGrams: "5.000" }],
      readyStock: [
        { brandId: 1, productId: 99, sourceMaterialId: 5, size: "17" },
        { brandId: 1, productId: 99, sourceMaterialId: 5, size: "18" },
      ],
    });

    expect(result.custom).toMatchObject({ status: "available" });
    expect(result.custom.requirements).toEqual([
      expect.objectContaining({ materialCode: "EMAS-75", requiredGrams: "4.950", availableGrams: "5.000" }),
    ]);
    expect(result.readyStock).toEqual({ status: "available", availableUnits: 1 });
  });

  it("does not claim availability when the order data is incomplete or the warehouse stock is short", () => {
    const result = buildOrderAvailability({
      order: {
        brandId: 1,
        productId: null,
        components: [{ id_gender: 1, id_jenis_bahan: 5, ukuran: null }],
        beratCincinPria: null,
        beratCincinWanita: null,
      },
      materials: [{ id: "gold", code: "EMAS-75", name: "Emas 75%", sourceMaterialId: 5, wastePercent: 0 }],
      balances: [{ materialId: "gold", quantityGrams: "1.000" }],
      readyStock: [],
    });

    expect(result.custom.status).toBe("incomplete");
    expect(result.readyStock.status).toBe("incomplete");
  });

  it("does not round a fractional waste requirement before deciding stock is sufficient", () => {
    const result = buildOrderAvailability({
      order: {
        brandId: 1,
        productId: null,
        components: [{ id_gender: 1, id_jenis_bahan: 5, ukuran: "17" }],
        beratCincinPria: "1.000",
        beratCincinWanita: null,
      },
      materials: [{ id: "gold", code: "EMAS-75", name: "Emas 75%", sourceMaterialId: 5, wastePercent: 0.04 }],
      balances: [{ materialId: "gold", quantityGrams: "1.000" }],
      readyStock: [],
    });

    expect(result.custom.status).toBe("insufficient");
    expect(result.custom.requirements[0]).toMatchObject({ requiredGrams: "1.000", availableGrams: "1.000" });
  });
});
