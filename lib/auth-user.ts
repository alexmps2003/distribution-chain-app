import { apiGet } from "@/lib/api-client";

export type AuthenticatedUserRole = "ADMIN" | "SALES_REP" | "COLLECTOR";

export type AuthenticatedUser = {
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  role: AuthenticatedUserRole;
  supabaseUserId: string;
};

export async function getAuthenticatedUser() {
  return apiGet<AuthenticatedUser>("/auth/me");
}

export function isAuthMeUnauthorizedError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "API GET /auth/me failed with 401"
  );
}
