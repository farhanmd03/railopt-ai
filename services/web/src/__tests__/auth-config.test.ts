import { describe, it, expect } from "vitest";
import {
  extractRoles,
  buildAuthUser,
  isRouteAllowedForRoles,
  hasRole,
  hasAnyRole,
  sanitizeReturnUrl,
} from "@/lib/auth-config";
import { User } from "oidc-client-ts";

describe("Auth Configuration & Role Mapping", () => {
  it("extracts roles from realm_access.roles and resource_access", () => {
    const mockUser = {
      profile: {
        sub: "user-123",
        preferred_username: "planner.demo",
        realm_access: {
          roles: ["PLANNER", "default-roles-railopt"],
        },
        resource_access: {
          "railopt-web": {
            roles: ["PLANNER"],
          },
        },
      },
    } as unknown as User;

    const roles = extractRoles(mockUser);
    expect(roles).toEqual(["PLANNER"]);
  });

  it("extracts multiple standard roles cleanly", () => {
    const mockUser = {
      profile: {
        sub: "admin-123",
        preferred_username: "admin.demo",
        realm_access: {
          roles: ["ADMIN", "PLANNER", "offline_access"],
        },
      },
    } as unknown as User;

    const roles = extractRoles(mockUser);
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("PLANNER");
  });

  it("handles null or undefined user profile safely", () => {
    expect(extractRoles(null)).toEqual([]);
    expect(extractRoles(undefined)).toEqual([]);
    expect(buildAuthUser(null)).toBeNull();
  });

  it("builds AuthUser with full name and primary username", () => {
    const mockUser = {
      profile: {
        sub: "usr-456",
        preferred_username: "planner.demo",
        given_name: "Planner",
        family_name: "User",
        email: "planner.demo@railopt.local",
        realm_access: {
          roles: ["PLANNER"],
        },
      },
    } as unknown as User;

    const authUser = buildAuthUser(mockUser);
    expect(authUser).toEqual({
      id: "usr-456",
      username: "planner.demo",
      name: "Planner User",
      email: "planner.demo@railopt.local",
      firstName: "Planner",
      lastName: "User",
      roles: ["PLANNER"],
    });
  });

  describe("isRouteAllowedForRoles (Role / Navigation Matrix)", () => {
    it("allows ADMIN to access all routes", () => {
      const routes = [
        "/dashboard",
        "/maintenance",
        "/planning",
        "/optimization",
        "/operations",
        "/map",
        "/approvals",
        "/audit",
      ];
      for (const route of routes) {
        expect(isRouteAllowedForRoles(route, ["ADMIN"])).toBe(true);
      }
    });

    it("restricts VIEWER to dashboard, map, and audit", () => {
      expect(isRouteAllowedForRoles("/dashboard", ["VIEWER"])).toBe(true);
      expect(isRouteAllowedForRoles("/map", ["VIEWER"])).toBe(true);
      expect(isRouteAllowedForRoles("/audit", ["VIEWER"])).toBe(true);

      expect(isRouteAllowedForRoles("/maintenance", ["VIEWER"])).toBe(false);
      expect(isRouteAllowedForRoles("/planning", ["VIEWER"])).toBe(false);
      expect(isRouteAllowedForRoles("/optimization", ["VIEWER"])).toBe(false);
      expect(isRouteAllowedForRoles("/approvals", ["VIEWER"])).toBe(false);
    });

    it("allows PLANNER access to planning, optimization, maintenance, operations", () => {
      expect(isRouteAllowedForRoles("/dashboard", ["PLANNER"])).toBe(true);
      expect(isRouteAllowedForRoles("/maintenance", ["PLANNER"])).toBe(true);
      expect(isRouteAllowedForRoles("/planning", ["PLANNER"])).toBe(true);
      expect(isRouteAllowedForRoles("/optimization", ["PLANNER"])).toBe(true);
      expect(isRouteAllowedForRoles("/operations", ["PLANNER"])).toBe(true);

      expect(isRouteAllowedForRoles("/approvals", ["PLANNER"])).toBe(false);
      expect(isRouteAllowedForRoles("/audit", ["PLANNER"])).toBe(false);
    });

    it("allows APPROVER access to optimization, approvals, dashboard", () => {
      expect(isRouteAllowedForRoles("/dashboard", ["APPROVER"])).toBe(true);
      expect(isRouteAllowedForRoles("/optimization", ["APPROVER"])).toBe(true);
      expect(isRouteAllowedForRoles("/approvals", ["APPROVER"])).toBe(true);

      expect(isRouteAllowedForRoles("/planning", ["APPROVER"])).toBe(false);
      expect(isRouteAllowedForRoles("/maintenance", ["APPROVER"])).toBe(false);
    });

    it("allows ENGINEERING access to maintenance, operations, dashboard", () => {
      expect(isRouteAllowedForRoles("/dashboard", ["ENGINEERING"])).toBe(true);
      expect(isRouteAllowedForRoles("/maintenance", ["ENGINEERING"])).toBe(true);
      expect(isRouteAllowedForRoles("/operations", ["ENGINEERING"])).toBe(true);

      expect(isRouteAllowedForRoles("/planning", ["ENGINEERING"])).toBe(false);
      expect(isRouteAllowedForRoles("/optimization", ["ENGINEERING"])).toBe(false);
      expect(isRouteAllowedForRoles("/approvals", ["ENGINEERING"])).toBe(false);
    });

    it("safely handles empty roles", () => {
      expect(isRouteAllowedForRoles("/dashboard", [])).toBe(false);
      expect(isRouteAllowedForRoles("/planning", [])).toBe(false);
    });
  });

  describe("hasRole and hasAnyRole helpers", () => {
    it("evaluates single role presence", () => {
      expect(hasRole(["PLANNER", "VIEWER"], "PLANNER")).toBe(true);
      expect(hasRole(["PLANNER", "VIEWER"], "ADMIN")).toBe(false);
    });

    it("evaluates multiple role match", () => {
      expect(hasAnyRole(["ENGINEERING"], ["ADMIN", "ENGINEERING"])).toBe(true);
      expect(hasAnyRole(["ENGINEERING"], ["ADMIN", "PLANNER"])).toBe(false);
    });
  });

  describe("sanitizeReturnUrl", () => {
    it("defaults to /dashboard when url is null, undefined, or empty", () => {
      expect(sanitizeReturnUrl(null)).toBe("/dashboard");
      expect(sanitizeReturnUrl(undefined)).toBe("/dashboard");
      expect(sanitizeReturnUrl("")).toBe("/dashboard");
    });

    it("allows valid internal paths", () => {
      expect(sanitizeReturnUrl("/planning")).toBe("/planning");
      expect(sanitizeReturnUrl("/optimization")).toBe("/optimization");
      expect(sanitizeReturnUrl("/maintenance/task-1")).toBe("/maintenance/task-1");
    });

    it("rejects protocol-relative URLs", () => {
      expect(sanitizeReturnUrl("//evil.com")).toBe("/dashboard");
      expect(sanitizeReturnUrl("//evil.com/planning")).toBe("/dashboard");
    });

    it("rejects absolute URLs", () => {
      expect(sanitizeReturnUrl("https://evil.com")).toBe("/dashboard");
      expect(sanitizeReturnUrl("http://localhost:8080/realms/railopt")).toBe("/dashboard");
    });

    it("rejects non-path schemes such as javascript", () => {
      expect(sanitizeReturnUrl("javascript:alert(1)")).toBe("/dashboard");
    });
  });
});
