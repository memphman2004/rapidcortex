import { csrfHeaders, ensureCsrfCookie } from "@/lib/csrf-client";

type SignOutOptions = {
  /** After cookies clear, navigate here (default `/`). Use `/login` for idle timeout. */
  redirectTo?: string;
};

/**
 * POST /api/auth/signout clears cookies and returns `{ ok: true }` (no server redirect).
 * Full page navigation ensures the next render does not reuse stale client session state.
 */
export async function signOutFromClient(opts?: SignOutOptions): Promise<void> {
  try {
    await ensureCsrfCookie();
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
    });
  } catch {
    // proceed regardless — cookies may still have been cleared
  }
  window.location.href = opts?.redirectTo ?? "/";
}
