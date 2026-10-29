export const WARRANTY_ADMINISTRATOR_PERMISSION = "warranty_administrator";
export const WARRANTY_ACTIVATION_VALIDATE_PERMISSION = "warranty.activation.validate";
export const WARRANTY_ACTIVATION_ACTIVATE_PERMISSION = "warranty.activation.activate";
export const WARRANTY_CONTRACT_READ_PERMISSION = "warranty.contract.read";
export const WARRANTY_CLAIM_READ_PERMISSION = "warranty.claim.read";
export const WARRANTY_CLAIM_CREATE_PERMISSION = "warranty.claim.create";
export const WARRANTY_CLAIM_SUBMIT_PERMISSION = "warranty.claim.submit";
export const WARRANTY_CLAIM_COMPLETE_NON_WORKSHOP_PERMISSION = "warranty.claim.complete_non_workshop";
export const WARRANTY_CLAIM_CANCEL_PERMISSION = "warranty.claim.cancel";
export const WARRANTY_EXCEPTION_REQUEST_PERMISSION = "warranty.exception.request";
export const WARRANTY_WORK_UPDATE_PERMISSION = "warranty.work.update";
export const WARRANTY_EXCEPTION_DECIDE_PERMISSION = "warranty.exception.decide";

export function canManageWarrantyPreparation(
  permissions: Record<string, unknown> | null | undefined,
): boolean {
  return permissions?.[WARRANTY_ADMINISTRATOR_PERMISSION] === true;
}

export function hasWarrantyPermission(
  permissions: Record<string, unknown> | null | undefined,
  permission: string,
): boolean {
  return permissions?.[permission] === true;
}
