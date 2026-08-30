/**
 * RailOpt AI — Keycloak OIDC Authentication Configuration for Next.js.
 *
 * Minimal foundation establishing OIDC parameters and helper types
 * for subsequent frontend dashboard and block planning integration.
 */

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

export const OIDC_CONFIG = {
  authority:
    process.env.NEXT_PUBLIC_KEYCLOAK_URL
      ? `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "railopt"}`
      : "http://localhost:8080/realms/railopt",
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "railopt-web",
  redirectUri:
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:3000/auth/callback",
  postLogoutRedirectUri:
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  scope: "openid profile email",
  responseType: "code",
} as const;

export const APP_ROLES = [
  "ADMIN",
  "PLANNER",
  "ENGINEERING",
  "SNT",
  "TRD",
  "CONTROL",
  "APPROVER",
  "VIEWER",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function hasRole(roles: string[], targetRole: AppRole): boolean {
  return roles.includes(targetRole);
}

export function hasAnyRole(roles: string[], targetRoles: AppRole[]): boolean {
  return targetRoles.some((r) => roles.includes(r));
}
