import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

export const AUTH_ROLE_HEADER = "x-sb-user-role";

export function getRequestRole(request: Request): UserRole {
  const header = request.headers.get(AUTH_ROLE_HEADER);
  if (header && isUserRole(header)) {
    return header;
  }
  return "superuser";
}
