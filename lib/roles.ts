export const USER_ROLES = {
  ADMIN: "ADMIN",
  COLLECTOR: "COLLECTOR",
  SALES_REP: "SALES_REP",
} as const;

export type AuthenticatedUserRole =
  (typeof USER_ROLES)[keyof typeof USER_ROLES];
