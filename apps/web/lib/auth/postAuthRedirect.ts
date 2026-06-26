import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Central post-auth redirect helper with open-redirect protection.
 * Defaults to a full document navigation so httpOnly session cookies are present
 * on the first dashboard load (soft `router.replace` after sign-in can corrupt
 * App Router RSC streams and surface the global "This page couldn't load" UI).
 */
export function postAuthRedirect(
  router: AppRouterInstance,
  redirectParam?: string | null,
  defaultPath = "/dashboard",
  opts?: { hard?: boolean },
): void {
  const target =
    redirectParam && isRelativePath(redirectParam) ? redirectParam : defaultPath;

  const useHardNav = opts?.hard !== false && typeof window !== "undefined";
  if (useHardNav) {
    hardNavigateTo(target);
    return;
  }

  router.replace(target);
}

function isRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

/** Full document navigation — avoids corrupting App Router RSC streams after auth or role redirects. */
export function hardNavigateTo(target: string): void {
  if (typeof window === "undefined") return;
  const path = isRelativePath(target) ? target : "/dashboard";
  window.location.assign(path);
}

