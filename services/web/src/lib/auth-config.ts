/**
 * RailOpt AI — Auth0 OIDC Authentication Configuration for Next.js.
 *
 * Real browser OIDC Authorization Code Flow with PKCE against Auth0.
 */

import { AuthProviderProps } from "react-oidc-context";
import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";

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

// Auth0 requires the issuer URL to have exactly one trailing slash
const rawIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER_URL || "https://farhanmd03.us.auth0.com/";
export const OIDC_ISSUER_URL = rawIssuer.endsWith("/") ? rawIssuer : `${rawIssuer}/`;

export const OIDC_CLIENT_ID = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "ARUiG1mbMmmzOi6TK3t5wrFY8otx5prl";

// Auth0 API Identifier
export const OIDC_AUDIENCE = process.env.NEXT_PUBLIC_OIDC_AUDIENCE || "https://railopt-ai-api";

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

  // CRITICAL: Auth0 audience must be passed in extraQueryParams for oidc-client-ts
  extraQueryParams: {
    audience: OIDC_AUDIENCE,
  },

  automaticSilentRenew: true,
  loadUserInfo: true,
} as const;

export function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url) return "/dashboard";

  if (!url.startsWith("/") || url.startsWith("//")) {
    return "/dashboard";
  }

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

let sharedUserManager: UserManager | null = null;

export function getSharedUserManager(): UserManager {
  if (typeof window === "undefined") {
    throw new Error("UserManager is only available in browser environments");
  }
  if (!sharedUserManager) {
    sharedUserManager = new UserManager({
      authority: OIDC_ISSUER_URL,
      client_id: OIDC_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: `${window.location.origin}/login`,
      response_type: "code",
      scope: "openid profile email",
      extraQueryParams: {
        audience: OIDC_AUDIENCE,
      },
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({
        store: window.sessionStorage,
      }),
    });
  }
  return sharedUserManager;
}

export function getOidcConfig(): AuthProviderProps {
  if (typeof window !== "undefined") {
    const userManager = getSharedUserManager();
    return {
      userManager,
      onSigninCallback: () => {
        const rawReturnUrl = window.sessionStorage.getItem("railopt_auth_return_url");
        const returnUrl = sanitizeReturnUrl(rawReturnUrl);
        window.sessionStorage.removeItem("railopt_auth_return_url");
        window.location.replace(returnUrl);
      },
    };
  }

  return {
    authority: OIDC_ISSUER_URL,
    client_id: OIDC_CLIENT_ID,
    redirect_uri: "http://localhost:3000/auth/callback",
    post_logout_redirect_uri: "http://localhost:3000/login",
    response_type: "code",
    scope: "openid profile email",
    extraQueryParams: {
      audience: OIDC_AUDIENCE,
    },
    automaticSilentRenew: true,
  };
}

export interface DemoSessionPayload {
  access_token: string;
  token_type?: string;
  expires_in: number;
  user: {
    sub: string;
    preferred_username: string;
    name: string;
    email: string;
    roles: string[];
  };
}

export async function setDemoUserSession(data: {
  access_token: string;
  token_type?: string;
  expires_in: number;
  user: {
    sub: string;
    preferred_username: string;
    name: string;
    email: string;
    roles: string[];
  };
}): Promise<User> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (data.expires_in || 28800);
  // Construct genuine User session with demo access_token.
  // We explicitly omit id_token so the demo JWT never masquerades as an OIDC ID token.
  // The API token getter in providers.tsx strictly reads user.access_token.
  const demoUser = new User({
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    scope: "openid profile email",
    profile: {
      iss: "railopt-demo",
      aud: OIDC_AUDIENCE,
      sub: data.user.sub,
      preferred_username: data.user.preferred_username,
      name: data.user.name,
      email: data.user.email,
      "https://railopt.ai/roles": data.user.roles,
      roles: data.user.roles,
      exp: expiresAt,
      iat: now,
    },
    expires_at: expiresAt,
  });

  const userManager = getSharedUserManager();
  await userManager.storeUser(demoUser);
  await userManager.events.load(demoUser);
  return demoUser;
}

export function isDemoSession(user: User | null | undefined): boolean {
  if (!user) return false;
  const iss = (user.profile as Record<string, unknown>)?.iss;
  const sub = user.profile?.sub || "";
  return iss === "railopt-demo" || sub.startsWith("demo|");
}

export function parseJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token || typeof token !== "string") {
    return null;
  }

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

export function extractRoles(user: User | null | undefined): AppRole[] {
  if (!user) return [];

  const extracted = new Set<string>();

  const processPayload = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload || typeof payload !== "object") return;

    // 1. Auth0 Namespaced Custom Claim
    const auth0Roles = payload["https://railopt.ai/roles"];
    if (Array.isArray(auth0Roles)) {
      auth0Roles.forEach((r) => {
        if (typeof r === "string") extracted.add(r.toUpperCase());
      });
    }

    // 2. Generic roles/groups claim fallback
    for (const key of ["roles", "groups", "permissions"]) {
      const claim = payload[key];
      if (Array.isArray(claim)) {
        claim.forEach((r) => {
          if (typeof r === "string") extracted.add(r.toUpperCase());
        });
      }
    }

    // 3. Legacy Keycloak fallbacks (preservation)
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    if (realmAccess?.roles && Array.isArray(realmAccess.roles)) {
      realmAccess.roles.forEach((r) => {
        if (typeof r === "string") extracted.add(r.toUpperCase());
      });
    }
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

  if (user.profile) {
    processPayload(user.profile as Record<string, unknown>);
  }

  if (user.access_token) {
    const accessTokenClaims = parseJwtPayload(user.access_token);
    if (accessTokenClaims) {
      processPayload(accessTokenClaims);
    }
  }

  return APP_ROLES.filter((role) => extracted.has(role));
}

export function buildAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;

  const profile = user.profile as Record<string, unknown>;
  const roles = extractRoles(user);
  const firstName = String(profile.given_name || profile.firstName || "");
  const lastName = String(profile.family_name || profile.lastName || "");
  // Preferred username, nickname, email, or sub
  const username = String(profile.preferred_username || profile.nickname || profile.email || user.profile.sub || "User");

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
  if (roles.includes("ADMIN")) {
    return true;
  }

  const matchedRoute = Object.keys(ROLE_ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!matchedRoute) {
    return pathname === "/dashboard" || pathname === "/";
  }

  const allowedRoles = ROLE_ROUTE_PERMISSIONS[matchedRoute];
  return roles.some((r) => allowedRoles.includes(r));
}
