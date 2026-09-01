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

export const OIDC_ISSUER_URL =
  process.env.NEXT_PUBLIC_OIDC_ISSUER_URL?.replace(/\/+$/, "") ||
  (process.env.NEXT_PUBLIC_AUTH0_DOMAIN
    ? (process.env.NEXT_PUBLIC_AUTH0_DOMAIN.startsWith("http")
        ? process.env.NEXT_PUBLIC_AUTH0_DOMAIN.replace(/\/+$/, "")
        : `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN.replace(/\/+$/, "")}`)
    : "") ||
  (process.env.NEXT_PUBLIC_KEYCLOAK_URL
    ? `${process.env.NEXT_PUBLIC_KEYCLOAK_URL.replace(/\/+$/, "")}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "railopt"}`
    : "http://localhost:8080/realms/railopt");

export const OIDC_CLIENT_ID =
  process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ||
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ||
  "railopt-web";

export const OIDC_AUDIENCE =
  process.env.NEXT_PUBLIC_OIDC_AUDIENCE || "https://railopt-ai-api";

export const OIDC_CONFIG = {
  authority: OIDC_ISSUER_URL,
  client_id: OIDC_CLIENT_ID,
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
  extraQueryParams: {
    audience: OIDC_AUDIENCE,
  },
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
    authority: OIDC_ISSUER_URL,
    client_id: OIDC_CLIENT_ID,
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
    extraQueryParams: {
      audience: OIDC_AUDIENCE,
    },
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
 * Safely decodes an unencrypted JWT payload without external libraries.
 */
export function parseJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonStr =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? decodeURIComponent(
            window
              .atob(padded)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          )
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Extract authenticated roles from OIDC token payload (Auth0 namespaced / Keycloak / generic).
 * Inspects both ID Token profile and Access Token claims.
 * Strictly whitelists against approved APP_ROLES.
 */
export function extractRoles(user: User | null | undefined): AppRole[] {
  if (!user) {
    return [];
  }

  const extracted = new Set<string>();

  const processPayload = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload || typeof payload !== "object") return;

    // 1. Check Auth0 namespaced claim (https://railopt.ai/roles)
    const auth0Roles = payload["https://railopt.ai/roles"];
    if (Array.isArray(auth0Roles)) {
      auth0Roles.forEach((r) => {
        if (typeof r === "string") extracted.add(r.toUpperCase());
      });
    }

    // 2. Check direct top-level roles/groups/permissions claims
    for (const key of ["roles", "groups", "permissions"]) {
      const claim = payload[key];
      if (Array.isArray(claim)) {
        claim.forEach((r) => {
          if (typeof r === "string") extracted.add(r.toUpperCase());
        });
      }
    }

    // 3. Check Keycloak realm_access.roles
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    if (realmAccess?.roles && Array.isArray(realmAccess.roles)) {
      realmAccess.roles.forEach((r) => {
        if (typeof r === "string") extracted.add(r.toUpperCase());
      });
    }

    // 4. Check Keycloak resource_access[client_id].roles
    const resourceAccess = payload.resource_access as Record<string, { roles?: string[] }> | undefined;
    if (resourceAccess && typeof resourceAccess === "object") {
      const clientAccess = resourceAccess[OIDC_CLIENT_ID] || resourceAccess["railopt-web"];
      if (clientAccess?.roles && Array.isArray(clientAccess.roles)) {
        clientAccess.roles.forEach((r) => {
          if (typeof r === "string") extracted.add(r.toUpperCase());
        });
      }
    }
  };

  // 1. Inspect user.profile (ID Token & UserInfo claims)
  if (user.profile) {
    processPayload(user.profile as Record<string, unknown>);
  }

  // 2. Inspect user.access_token (OAuth2 Access Token claims)
  if (user.access_token) {
    const accessTokenClaims = parseJwtPayload(user.access_token);
    if (accessTokenClaims) {
      processPayload(accessTokenClaims);
    }
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
