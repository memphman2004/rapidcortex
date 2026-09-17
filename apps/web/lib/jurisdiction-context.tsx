"use client";

import { createContext, useCallback, useContext } from "react";

const JurisdictionContext = createContext<string | null>(null);
const CallAssistProductBaseContext = createContext<string | null>(null);

export function JurisdictionProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <JurisdictionContext.Provider value={slug}>{children}</JurisdictionContext.Provider>
  );
}

/** Rewrites `/call-assist/...` links onto the Call Assist–only product shell. */
export function CallAssistProductBaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <CallAssistProductBaseContext.Provider value="/app/call-assist">
      {children}
    </CallAssistProductBaseContext.Provider>
  );
}

export function useJurisdictionSlug(): string {
  const slug = useContext(JurisdictionContext);
  if (!slug) {
    throw new Error("useJurisdictionSlug must be used under /[jurisdiction]");
  }
  return slug;
}

/** Returns a stable function: `/dashboard` → `/${slug}/dashboard`. */
export function useJurisdictionLink(): (path: string) => string {
  const slug = useContext(JurisdictionContext);
  const productBase = useContext(CallAssistProductBaseContext);
  return useCallback((path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (productBase) {
      const stripped = normalized.replace(/^\/call-assist(?=\/|$)/, "");
      if (!stripped || stripped === "/") return productBase;
      return `${productBase}${stripped}`;
    }
    if (!slug) {
      throw new Error("useJurisdictionLink must be used under /[jurisdiction]");
    }
    return `/${slug}${normalized}`;
  }, [slug, productBase]);
}

export function useOptionalJurisdictionSlug(): string | null {
  return useContext(JurisdictionContext);
}

export function useCallAssistProductBase(): string | null {
  return useContext(CallAssistProductBaseContext);
}
