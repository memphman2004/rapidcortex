"use client";

import { SessionProvider } from "@/components/auth/session-context";
import { AgencyProvider } from "@/contexts/agency-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ALSMapProvider } from "@/lib/map/als-map-context";
import "maplibre-gl/dist/maplibre-gl.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AgencyProvider>
          <ALSMapProvider>{children}</ALSMapProvider>
        </AgencyProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
