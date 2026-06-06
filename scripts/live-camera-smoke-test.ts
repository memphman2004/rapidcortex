#!/usr/bin/env npx tsx
/**
 * Live camera pipeline smoke test.
 * Usage: SMOKE_BASE=https://... SMOKE_JWT=... npx tsx scripts/live-camera-smoke-test.ts
 */

const base = process.env.SMOKE_BASE ?? "";
const jwt = process.env.SMOKE_JWT ?? "";

if (!base || !jwt) {
  console.error("Missing SMOKE_BASE or SMOKE_JWT");
  process.exit(1);
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function run() {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  const missingBody = await post("/api/stream/viewer-token", {});
  checks.push({
    name: "viewer-token requires sessionId/product",
    ok: missingBody.status === 400,
    detail: `status=${missingBody.status}`,
  });

  const missingSession = await post("/api/stream/viewer-token", {
    sessionId: "sess-missing",
    product: "connect",
  });
  checks.push({
    name: "viewer-token missing session returns 404",
    ok: missingSession.status === 404,
    detail: `status=${missingSession.status}`,
  });

  const pendingSession = await post("/api/stream/viewer-token", {
    sessionId: "sess-pending-sample",
    product: "connect",
  });
  checks.push({
    name: "viewer-token non-active returns 404/409",
    ok: pendingSession.status === 404 || pendingSession.status === 409,
    detail: `status=${pendingSession.status}`,
  });

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const marker = c.ok ? "PASS" : "FAIL";
    console.log(`${marker} - ${c.name} (${c.detail})`);
  }
  if (failed.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Smoke test failed", err);
  process.exit(1);
});
