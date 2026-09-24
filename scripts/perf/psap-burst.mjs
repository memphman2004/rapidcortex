/**
 * Concurrent health probe that records a status for every request.
 *
 * hey -c above 125 (results/breaking-point-test.md, 2026-08-17) finished fewer
 * than -n requests and left those rows with no HTTP status. API Gateway 5xx,
 * Lambda errors, and DynamoDB throttles were zero on that run. This runner
 * treats a missing status as a failure so a client shortfall cannot look like
 * a clean platform pass.
 *
 * Usage:
 *   node scripts/perf/psap-burst.mjs --url https://example/api/health --n 500 --c 200
 */

export function summarizeBurst(results, expected) {
  const completed = results.filter((row) => Number.isInteger(row?.status));
  const missing = Math.max(0, expected - completed.length);
  const http429 = completed.filter((row) => row.status === 429).length;
  const http5xx = completed.filter((row) => row.status >= 500).length;
  const network = completed.filter((row) => row.status === 0).length;
  const ok = completed.filter((row) => row.status >= 200 && row.status < 300).length;
  const pass =
    completed.length === expected &&
    missing === 0 &&
    network === 0 &&
    http429 === 0 &&
    http5xx === 0 &&
    ok === expected;
  return {
    expected,
    completed: completed.length,
    missing,
    network,
    http429,
    http5xx,
    ok,
    pass,
  };
}

async function one(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return { status: response.status };
  } catch {
    return { status: 0 };
  }
}

async function run(url, total, concurrency) {
  const results = new Array(total);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= total) return;
      results[index] = await one(url);
    }
  }
  const workers = Math.min(concurrency, total);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const invokedDirectly = process.argv[1]?.endsWith("psap-burst.mjs");
if (invokedDirectly) {
  const url = arg("--url", "");
  const total = Number(arg("--n", "500"));
  const concurrency = Number(arg("--c", "200"));
  if (!url || !Number.isFinite(total) || !Number.isFinite(concurrency)) {
    console.error("Usage: node scripts/perf/psap-burst.mjs --url <health> --n 500 --c 200");
    process.exit(2);
  }
  const summary = summarizeBurst(await run(url, total, concurrency), total);
  console.log(JSON.stringify(summary));
  process.exit(summary.pass ? 0 : 1);
}
