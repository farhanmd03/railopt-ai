/**
 * RailOpt AI — Keycloak OIDC Authentication Configuration for Next.js.
 *
 * Real browser OIDC Authorization Code Flow with PKCE against local Keycloak.
 */

import { AuthProviderProps } from "react-oidc-context";
import { User, WebStorageStateStore } from "oidc-client-ts";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: AppRole[];
}

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

const KEYCLOAK_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_URL?.replace(/\/+$/, "") || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "railopt";
const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "railopt-web";

export const OIDC_CONFIG = {
  authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
  client_id: KEYCLOAK_CLIENT_ID,
  redirect_uri:
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:3000/auth/callback",
  post_logout_redirect_uri:
    typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : "http://localhost:3000/login",
  response_type: "code",
  scope: "openid profile email",
  automaticSilentRenew: true,
  loadUserInfo: true,
} as const;

/**
 * Validates that a return URL is a safe, same-origin, internal path.
 * Rejects absolute URLs, protocol-relative URLs, and anything not
 * starting with a single "/".
 */
export function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url) return "/dashboard";
  // Reject protocol-relative ("//host/...") and any URL containing a
  // scheme (e.g. "javascript:", "https:"). A safe internal path must
  // start with exactly one "/" and not two.
  if (!url.startsWith("/") || url.startsWith("//")) {
    return "/dashboard";
  }
  // Reject anything that still parses as an absolute URL when resolved
  // against window.location.origin, as a defense-in-depth check.
  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost:3000";
    const resolved = new URL(url, origin);
    if (resolved.origin !== origin) {
      return "/dashboard";
    }
  } catch {
    return "/dashboard";
  }
  return url;
}

export function getOidcConfig(): AuthProviderProps {
  return {
    authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
    client_id: KEYCLOAK_CLIENT_ID,
    redirect_uri:
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : "http://localhost:3000/auth/callback",
    post_logout_redirect_uri:
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : "http://localhost:3000/login",
    response_type: "code",
    scope: "openid profile email",
    automaticSilentRenew: true,
    userStore:
      typeof window !== "undefined"
        ? new WebStorageStateStore({ store: window.sessionStorage })
        : undefined,
    onSigninCallback: () => {
      if (typeof window !== "undefined") {
        const rawReturnUrl = window.sessionStorage.getItem("railopt_auth_return_url");
        const returnUrl = sanitizeReturnUrl(rawReturnUrl);
        window.sessionStorage.removeItem("railopt_auth_return_url");
        window.location.replace(returnUrl);
      }
    },
  };
}

/**
 * Extract authenticated roles from standard Keycloak token payload.
 */
export function extractRoles(user: User | null | undefined): AppRole[] {
  if (!user || !user.profile) {
    return [];
  }

  const profile = user.profile as Record<string, unknown>;
  const extracted = new Set<string>();

  // 1. Check realm_access.roles
  const realmAccess = profile.realm_access as { roles?: string[] } | undefined;
  if (realmAccess?.roles && Array.isArray(realmAccess.roles)) {
    realmAccess.roles.forEach((r) => extracted.add(r.toUpperCase()));
  }

  // 2. Check resource_access[client_id].roles
  const resourceAccess = profile.resource_access as Record<string, { roles?: string[] }> | undefined;
  if (resourceAccess && resourceAccess[KEYCLOAK_CLIENT_ID]?.roles) {
    resourceAccess[KEYCLOAK_CLIENT_ID].roles?.forEach((r) => extracted.add(r.toUpperCase()));
  }

  // 3. Check direct roles claim if mapped
  if (Array.isArray(profile.roles)) {
    profile.roles.forEach((r) => extracted.add(String(r).toUpperCase()));
  }

  return APP_ROLES.filter((role) => extracted.has(role));
}

/**
 * Build clean AuthUser identity from OIDC user object.
 */
export function buildAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;

  const profile = user.profile as Record<string, unknown>;
  const roles = extractRoles(user);
  const firstName = String(profile.given_name || profile.firstName || "");
  const lastName = String(profile.family_name || profile.lastName || "");
  const username = String(profile.preferred_username || user.profile.sub || "User");
  const name =
    firstName || lastName
      ? `${firstName} ${lastName}`.trim()
      : username;

  return {
    id: user.profile.sub || "",
    username,
    name,
    email: profile.email ? String(profile.email) : undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    roles,
  };
}

export function hasRole(roles: string[], targetRole: AppRole): boolean {
  return roles.includes(targetRole);
}

export function hasAnyRole(roles: string[], targetRoles: AppRole[]): boolean {
  return targetRoles.some((r) => roles.includes(r));
}

/**
 * Role-Aware Route Visibility Mapping (UX Only).
 * Backend REST API remains the authoritative security enforcement.
 */
export const ROLE_ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/dashboard": ["ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD", "CONTROL", "APPROVER", "VIEWER"],
  "/maintenance": ["ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD"],
  "/planning": ["ADMIN", "PLANNER", "CONTROL"],
  "/optimization": ["ADMIN", "PLANNER", "CONTROL", "APPROVER"],
  "/operations": ["ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD", "CONTROL"],
  "/map": ["ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD", "CONTROL", "APPROVER", "VIEWER"],
  "/approvals": ["ADMIN", "APPROVER"],
  "/audit": ["ADMIN", "VIEWER"],
};

export function isRouteAllowedForRoles(pathname: string, roles: AppRole[]): boolean {
  // ADMIN has full visibility
  if (roles.includes("ADMIN")) {
    return true;
  }

  // Exact or prefix match
  const matchedRoute = Object.keys(ROLE_ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!matchedRoute) {
    // Default safe fallback: allow dashboard
    return pathname === "/dashboard" || pathname === "/";
  }

  const allowedRoles = ROLE_ROUTE_PERMISSIONS[matchedRoute];
  return roles.some((r) => allowedRoles.includes(r));
}
