import { USER_ROLES, type AuthenticatedUserRole } from "@/lib/roles";

type MaybeRole = AuthenticatedUserRole | null | undefined;

const ALL_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.SALES_REP,
  USER_ROLES.COLLECTOR,
] as const;
const ADMIN_ONLY = [USER_ROLES.ADMIN] as const;
const ADMIN_OR_SALES_REP = [
  USER_ROLES.ADMIN,
  USER_ROLES.SALES_REP,
] as const;
const ADMIN_OR_COLLECTOR = [
  USER_ROLES.ADMIN,
  USER_ROLES.COLLECTOR,
] as const;

function hasRole(
  role: MaybeRole,
  allowedRoles: readonly AuthenticatedUserRole[],
) {
  return Boolean(role && allowedRoles.includes(role));
}

export function canCreateCustomer(role: MaybeRole) {
  return hasRole(role, ADMIN_OR_SALES_REP);
}

export function canEditCustomer(role: MaybeRole) {
  return hasRole(role, ADMIN_ONLY);
}

export function canDeleteCustomer(role: MaybeRole) {
  return hasRole(role, ADMIN_ONLY);
}

export function canCreateInvoice(role: MaybeRole) {
  return hasRole(role, ADMIN_OR_SALES_REP);
}

export function canEditInvoice(role: MaybeRole) {
  return hasRole(role, ADMIN_OR_SALES_REP);
}

export function canDeleteInvoice(role: MaybeRole) {
  return hasRole(role, ADMIN_ONLY);
}

export function canCreatePayment(role: MaybeRole) {
  return hasRole(role, ADMIN_OR_COLLECTOR);
}

export function canReverseCheque(role: MaybeRole) {
  return hasRole(role, ADMIN_ONLY);
}

export function canUndoChequeReversal(role: MaybeRole) {
  return hasRole(role, ADMIN_ONLY);
}

export function canViewReports(role: MaybeRole) {
  return hasRole(role, ALL_ROLES);
}
