export const INTAKE_VALIDATION_PERMISSION = "can_validate_intake";

export type IntakeState =
  | "pending_spv_cs_validation"
  | "approved_spv_cs"
  | "returned_for_revision"
  | "rejected_by_spv_cs"
  | "cancelled_from_source";

export function shouldQueueIntakeValidation(
  state: IntakeState | null | undefined,
): boolean {
  return state !== "approved_spv_cs"
    && state !== "returned_for_revision"
    && state !== "rejected_by_spv_cs"
    && state !== "cancelled_from_source";
}

export interface BrandIntakePolicy {
  brand_code: string;
  requires_pre_receipt_validation: boolean;
  is_active: boolean;
}

type IntakeOrderRelation =
  | { id_brand: number | null }
  | { id_brand: number | null }[]
  | null
  | undefined;

export function requiresPreReceiptValidation(
  policies: BrandIntakePolicy[],
  brandCode: string,
): boolean {
  const policy = policies.find((item) => item.brand_code === brandCode);
  return Boolean(policy?.is_active && policy.requires_pre_receipt_validation);
}

export function canValidateIntake(
  permissions: Record<string, unknown> | null | undefined,
): boolean {
  return permissions?.[INTAKE_VALIDATION_PERMISSION] === true;
}

export function hasIntakeBrand(
  legacyOrders: IntakeOrderRelation,
  brandId: number,
): boolean {
  if (Array.isArray(legacyOrders)) {
    return legacyOrders.some((order) => order.id_brand === brandId);
  }
  return legacyOrders?.id_brand === brandId;
}
