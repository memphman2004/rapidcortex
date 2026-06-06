import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Central post-auth redirect helper with open-redirect protection.
 * Uses history-safe `replace` so auth pages are not kept in browser history.
 */
export function postAuthRedirect(
  router: AppRouterInstance,
  redirectParam?: string | null,
  defaultPath = "/dashboard",
): void {
  if (redirectParam && isRelativePath(redirectParam)) {
    router.replace(redirectParam);
    return;
  }
  router.replace(defaultPath);
}

function isRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

