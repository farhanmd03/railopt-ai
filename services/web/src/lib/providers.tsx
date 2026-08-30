"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "react-oidc-context";
import { useEffect, useState, type ReactNode } from "react";
import { getOidcConfig } from "./auth-config";
import { setAuthTokenGetter } from "./api-client";

function ApiTokenSync({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => auth.user?.access_token || null);
  }, [auth.user?.access_token]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const oidcConfig = getOidcConfig();

  return (
    <AuthProvider {...oidcConfig}>
      <ApiTokenSync>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiTokenSync>
    </AuthProvider>
  );
}
