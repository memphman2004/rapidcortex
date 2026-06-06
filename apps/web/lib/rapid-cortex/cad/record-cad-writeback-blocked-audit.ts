import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";

type AuditBody = {
  action: string;
  incidentId?: string;
};

/**
 * Persist a Dynamo audit row via upstream API — never throws to callers (best-effort).
 */
export async function recordCadWritebackBlockedAudit(input: AuditBody): Promise<void> {
  const base = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "");
  if (!base) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[cad] CAD write-back audit skipped: API_UPSTREAM_BASE not configured.");
    }
    return;
  }
  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return;

  const target = `${base}/api/security/cad-writeback-blocked`;

  await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  }).catch((err: unknown) => {
    console.warn("[cad] Failed to record CAD write-back audit:", err instanceof Error ? err.message : err);
  });
}
