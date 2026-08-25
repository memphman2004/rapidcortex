"use client";

import { SessionProvider } from "@/components/auth/session-context";

/** Static marketing — no React Query (unused on these pages; saves initial JS). */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
