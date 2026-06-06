"use client";

import { createContext, useCallback, useContext } from "react";

const JurisdictionContext = createContext<string | null>(null);

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

export function useJurisdictionSlug(): string {
  const slug = useContext(JurisdictionContext);
  if (!slug) {
    throw new Error("useJurisdictionSlug must be used under /[jurisdiction]");
  }
  return slug;
}

/** Returns a stable function: `/dashboard` → `/${slug}/dashboard`. */
export function useJurisdictionLink(): (path: string) => string {
  const slug = useJurisdictionSlug();
  return useCallback((path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `/${slug}${normalized}`;
  }, [slug]);
}

export function useOptionalJurisdictionSlug(): string | null {
  return useContext(JurisdictionContext);
}
