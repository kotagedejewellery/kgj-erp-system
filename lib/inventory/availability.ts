import { buildCustomIssueLines } from "@/lib/inventory/custom-issue";

type Component = {
  id_gender: number | string | null;
  id_jenis_bahan: number | string | null;
  ukuran: string | null;
};

type Material = {
  id: string;
  code: string;
  name: string;
  sourceMaterialId: number;
  wastePercent: number | string | null;
};

type Balance = {
  materialId: string;
  quantityGrams: number | string;
};

type ReadyStockUnit = {
  brandId: number;
  productId: number | null;
  sourceMaterialId: number | null;
  size: string | null;
};

export type OrderAvailabilityInput = {
  order: {
    brandId: number;
    productId: number | null;
    components: Component[];
    beratCincinPria: number | string | null;
    beratCincinWanita: number | string | null;
  };
  materials: Material[];
  balances: Balance[];
  readyStock: ReadyStockUnit[];
};

export type AvailabilityStatus = "available" | "insufficient" | "incomplete";

function formatGrams(value: number): string {
  return value.toFixed(3);
}

function positiveInteger(value: number | string | null): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isReadyStockInputComplete(order: OrderAvailabilityInput["order"]): {
  sourceMaterialId: number;
  size: string;
} | null {
  if (!positiveInteger(order.productId)) return null;
  const materialComponents = order.components.filter((component) => positiveInteger(component.id_jenis_bahan));
  if (materialComponents.length !== 1) return null;

  const component = materialComponents[0];
  const sourceMaterialId = positiveInteger(component.id_jenis_bahan);
  const size = component.ukuran?.trim() ?? "";
  return sourceMaterialId && size ? { sourceMaterialId, size } : null;
}

export function canReadInventoryAvailability(status: string | null | undefined, roleName: string): boolean {
  return status === "active" && [
    "superadmin",
    "management",
    "customer_service_supervisor",
    "operational_supervisor",
    "production_supervisor",
  ].includes(roleName);
}

export function buildOrderAvailability(input: OrderAvailabilityInput) {
  const materialById = new Map(input.materials.map((material) => [material.id, material]));
  const balanceByMaterialId = new Map(input.balances.map((balance) => [balance.materialId, Number(balance.quantityGrams)]));

  let custom: {
    status: AvailabilityStatus;
    requirements: Array<{ materialCode: string; materialName: string; requiredGrams: string; availableGrams: string }>;
  };

  try {
    const lines = buildCustomIssueLines({
      components: input.order.components,
      berat_cincin_pria: input.order.beratCincinPria,
      berat_cincin_wanita: input.order.beratCincinWanita,
      materials: input.materials.map((material) => ({ sourceMaterialId: material.sourceMaterialId, materialId: material.id })),
    });
    const requirements = lines.map((line) => {
      const material = materialById.get(line.materialId)!;
      const required = Number(line.weightGrams) * (1 + Number(material.wastePercent ?? 0) / 100);
      const available = balanceByMaterialId.get(line.materialId) ?? 0;
      return {
        materialCode: material.code,
        materialName: material.name,
        requiredGrams: formatGrams(required),
        availableGrams: formatGrams(available),
        isSufficient: available >= required,
      };
    });
    custom = {
      status: requirements.every((line) => line.isSufficient) ? "available" : "insufficient",
      requirements: requirements.map(({ isSufficient: _isSufficient, ...line }) => line),
    };
  } catch {
    custom = { status: "incomplete", requirements: [] };
  }

  const readyStockDetails = isReadyStockInputComplete(input.order);
  const availableUnits = readyStockDetails
    ? input.readyStock.filter((unit) =>
      unit.brandId === input.order.brandId &&
      unit.productId === input.order.productId &&
      unit.sourceMaterialId === readyStockDetails.sourceMaterialId &&
      unit.size === readyStockDetails.size,
    ).length
    : 0;

  return {
    custom,
    readyStock: readyStockDetails
      ? { status: availableUnits > 0 ? "available" as const : "insufficient" as const, availableUnits }
      : { status: "incomplete" as const, availableUnits: 0 },
  };
}
