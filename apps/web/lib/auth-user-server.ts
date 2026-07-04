import { apiGet } from "@/lib/api-client-server";
import type { AuthenticatedUser } from "@/lib/auth-user";

export async function getAuthenticatedUserServer() {
  return apiGet<AuthenticatedUser>("/auth/me");
}
