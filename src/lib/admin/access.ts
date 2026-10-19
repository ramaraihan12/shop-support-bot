import { checkBasicAuth } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export type AdminAccess = "disabled" | "granted" | "denied";

/** Admin stays off until ADMIN_PASSWORD is set. */
export function adminAccess(authorization: string | null): AdminAccess {
  const { ADMIN_USER, ADMIN_PASSWORD } = getEnv();
  if (!ADMIN_PASSWORD) return "disabled";
  return checkBasicAuth(authorization, ADMIN_USER, ADMIN_PASSWORD) ? "granted" : "denied";
}
