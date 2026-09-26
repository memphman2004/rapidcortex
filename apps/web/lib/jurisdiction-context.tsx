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

/** Rewrites `/call-assist/...` links onto a Call Assist product shell (app or RC admin). */
export function CallAssistProductBaseProvider({
  children,
  base = "/app/call-assist",
}: {
  children: React.ReactNode;
  /** Root for Call Assist chrome links (default `/app/call-assist`). */
  base?: string;
}) {
  return (
    <CallAssistProductBaseContext.Provider value={base}>
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
