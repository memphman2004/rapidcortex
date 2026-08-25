#!/usr/bin/env python3
"""Concurrent GET load wave with latency percentiles. Read-only."""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed


def percentile(sorted_vals: list[float], p: float) -> float | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = k - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def one_get(url: str, timeout: float) -> dict:
    started = time.perf_counter()
    status = 0
    error = None
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "rc-stress-wave/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = int(resp.status)
            resp.read()
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        try:
            exc.read()
        except Exception:
            pass
        error = f"HTTPError {exc.code}"
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"
    ms = (time.perf_counter() - started) * 1000.0
    return {"status": status, "ms": round(ms, 2), "error": error}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--requests", type=int, required=True)
    parser.add_argument("--concurrency", type=int, required=True)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--label", default="")
    args = parser.parse_args()

    started = time.perf_counter()
    rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futs = [pool.submit(one_get, args.url, args.timeout) for _ in range(args.requests)]
        for fut in as_completed(futs):
            rows.append(fut.result())
    elapsed_s = time.perf_counter() - started

    latencies = sorted(r["ms"] for r in rows)
    statuses: dict[str, int] = {}
    for r in rows:
        key = str(r["status"] or "0")
        statuses[key] = statuses.get(key, 0) + 1

    completed = len(rows)
    http_2xx = sum(1 for r in rows if 200 <= r["status"] < 300)
    http_4xx = sum(1 for r in rows if 400 <= r["status"] < 500)
    http_5xx = sum(1 for r in rows if 500 <= r["status"] < 600)
    transport_errors = sum(1 for r in rows if r["status"] == 0)
    success_rate = (http_2xx / completed * 100.0) if completed else 0.0

    out = {
        "label": args.label,
        "url": args.url,
        "requests": args.requests,
        "concurrency": args.concurrency,
        "elapsed_s": round(elapsed_s, 3),
        "completed": completed,
        "success_2xx": http_2xx,
        "http_4xx": http_4xx,
        "http_5xx": http_5xx,
        "transport_errors": transport_errors,
        "success_rate_pct": round(success_rate, 2),
        "p50_ms": round(percentile(latencies, 50) or 0, 2),
        "p95_ms": round(percentile(latencies, 95) or 0, 2),
        "p99_ms": round(percentile(latencies, 99) or 0, 2),
        "avg_ms": round(statistics.mean(latencies), 2) if latencies else None,
        "max_ms": round(max(latencies), 2) if latencies else None,
        "min_ms": round(min(latencies), 2) if latencies else None,
        "statuses": statuses,
        "sample_errors": [r["error"] for r in rows if r["error"]][:8],
    }
    print(json.dumps(out, indent=2))
    return 0 if transport_errors == 0 and http_5xx == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
