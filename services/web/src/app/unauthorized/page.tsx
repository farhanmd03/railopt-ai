"use client";

import React from "react";
import { ForbiddenState } from "@/components/feedback/forbidden-state";
import { useAuth } from "react-oidc-context";
import { extractRoles } from "@/lib/auth-config";

export default function UnauthorizedPage() {
  const auth = useAuth();
  const roles = extractRoles(auth.user);

  return <ForbiddenState userRoles={roles} />;
}
