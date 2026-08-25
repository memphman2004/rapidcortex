#!/usr/bin/env python3
"""Ramp concurrency against /api/health until a stop criterion is hit."""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path("/Volumes/Mac Mini/Coding Projects/Rapid Cortex/results/breaking-point")
ROOT.mkdir(parents=True, exist_ok=True)

API_URL = os.environ.get(
    "API_URL", "https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com"
).rstrip("/")
HEALTH_URL = f"{API_URL}/api/health"
PROFILE = os.environ.get("AWS_PROFILE", "rapid-cortex")
REGION = os.environ.get("AWS_REGION", "us-east-1")
HEALTH_FN = "rapid-cortex-dev-AppSamStackV2-1BR5-HealthFunction-7ntwCgRvu0zE"
# Background pipeline noise is recorded but does not stop the health-path ramp.
LOAD_PATH_ERROR_MARKERS = ("HealthFunction",)

LEVELS = [10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000]
N_REQUESTS = 500


def aws_json(args: list[str]) -> dict | list | None:
    cmd = ["aws", *args, "--profile", PROFILE, "--region", REGION, "--output", "json"]
    try:
        raw = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT)
        return json.loads(raw) if raw.strip() else None
    except subprocess.CalledProcessError as exc:
        print("AWS error:", exc.output[:500] if exc.output else exc)
        return None
    except json.JSONDecodeError:
        return None


def parse_hey(text: str) -> dict:
    rps = None
    m = re.search(r"Requests/sec:\s*([0-9.]+)", text)
    if m:
        rps = float(m.group(1))

    statuses: dict[str, int] = {}
    in_status = False
    for line in text.splitlines():
        if line.strip().startswith("Status code distribution"):
            in_status = True
            continue
        if in_status:
            sm = re.search(r"\[(\d+)\]\s+(\d+)", line)
            if sm:
                statuses[sm.group(1)] = int(sm.group(2))
            elif line.strip() == "":
                if statuses:
                    in_status = False

    lat: dict[str, float] = {}
    for pct, val in re.findall(r"(\d+)%% in ([0-9.]+) secs", text):
        lat[pct] = float(val) * 1000.0  # ms

    err_lines = [
        ln.strip()
        for ln in text.splitlines()
        if "error" in ln.lower() and not ln.strip().startswith("Error count")
    ]
    timeout_n = len(re.findall(r"timeout|Timeout|deadline", text, re.I))

    completed = sum(statuses.values())
    ok2 = sum(n for code, n in statuses.items() if code.startswith("2"))
    n5 = sum(n for code, n in statuses.items() if code.startswith("5"))
    n429 = statuses.get("429", 0)
    n4 = sum(n for code, n in statuses.items() if code.startswith("4"))
    success = (ok2 / completed * 100.0) if completed else 0.0
    err5_rate = (n5 / completed * 100.0) if completed else 0.0
    err_rate = ((completed - ok2) / completed * 100.0) if completed else 100.0

    return {
        "rps": rps,
        "statuses": statuses,
        "completed": completed,
        "success_pct": round(success, 2),
        "err_rate_pct": round(err_rate, 2),
        "err5_rate_pct": round(err5_rate, 2),
        "n2xx": ok2,
        "n4xx": n4,
        "n429": n429,
        "n5xx": n5,
        "p50_ms": round(lat.get("50", 0.0), 2),
        "p90_ms": round(lat.get("90", 0.0), 2),
        "p95_ms": round(lat.get("95", 0.0), 2),
        "p99_ms": round(lat.get("99", 0.0), 2),
        "timeout_mentions": timeout_n,
        "error_lines": err_lines[:12],
    }


def cw_window(minutes: int = 2) -> tuple[str, str]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutes)
    fmt = "%Y-%m-%dT%H:%M:%S"
    return start.strftime(fmt), end.strftime(fmt)


def metric_max(namespace: str, metric: str, dimensions: list[dict] | None, stat: str) -> float:
    start, end = cw_window(2)
    args = [
        "cloudwatch",
        "get-metric-statistics",
        "--namespace",
        namespace,
        "--metric-name",
        metric,
        "--start-time",
        start,
        "--end-time",
        end,
        "--period",
        "60",
        "--statistics",
        stat,
    ]
    if dimensions:
        dim_cli = []
        for d in dimensions:
            dim_cli.append(f"Name={d['Name']},Value={d['Value']}")
        args.extend(["--dimensions", *dim_cli])
    data = aws_json(args)
    pts = (data or {}).get("Datapoints") or []
    vals = [float(p.get(stat, 0) or 0) for p in pts]
    return max(vals) if vals else 0.0


def lambda_errors_excluding_camera() -> dict:
    start, end = cw_window(3)
    query = json.dumps(
        [
            {
                "Id": "errs",
                "Expression": "SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Errors\" FunctionName=rapid-cortex-dev', 'Sum', 60)",
                "Period": 60,
                "ReturnData": True,
            }
        ]
    )
    data = aws_json(
        [
            "cloudwatch",
            "get-metric-data",
            "--start-time",
            start,
            "--end-time",
            end,
            "--metric-data-queries",
            query,
        ]
    )
    rows = []
    total = 0.0
    non_camera = 0.0
    for r in (data or {}).get("MetricDataResults") or []:
        label = r.get("Label") or r.get("Id") or ""
        s = sum(r.get("Values") or [])
        if s <= 0:
            continue
        rows.append({"label": label, "sum": s})
        total += s
        if "CameraHeartbeat" not in label:
            non_camera += s
    rows.sort(key=lambda x: x["sum"], reverse=True)
    load_path = sum(
        r["sum"] for r in rows if any(m in r["label"] for m in LOAD_PATH_ERROR_MARKERS)
    )
    return {
        "total": total,
        "non_camera": non_camera,
        "load_path": load_path,
        "by_function": rows[:12],
    }


def ddb_throttles() -> float:
    start, end = cw_window(3)
    query = json.dumps(
        [
            {
                "Id": "t",
                "Expression": "SUM(SEARCH('{AWS/DynamoDB,TableName} MetricName=\"ThrottledRequests\" TableName=rapid-cortex', 'Sum', 60))",
                "Period": 60,
                "ReturnData": True,
            }
        ]
    )
    data = aws_json(
        [
            "cloudwatch",
            "get-metric-data",
            "--start-time",
            start,
            "--end-time",
            end,
            "--metric-data-queries",
            query,
        ]
    )
    results = (data or {}).get("MetricDataResults") or []
    if not results:
        return 0.0
    return float(sum(results[0].get("Values") or []))


def run_hey(concurrency: int, label: str) -> dict:
    out_path = ROOT / f"{label}.hey.txt"
    cmd = ["hey", "-n", str(N_REQUESTS), "-c", str(concurrency), "-q", "0", HEALTH_URL]
    print(f"\n===== {label}  n={N_REQUESTS} c={concurrency}  {HEALTH_URL} =====", flush=True)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    text = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    out_path.write_text(text)
    parsed = parse_hey(text)
    parsed["exit_code"] = proc.returncode
    parsed["raw_path"] = str(out_path)
    return parsed


def evaluate(parsed: dict, cw: dict) -> tuple[str, list[str]]:
    reasons = []
    if parsed["err5_rate_pct"] > 1.0:
        reasons.append(f"HTTP 5xx {parsed['err5_rate_pct']}% > 1%")
    if parsed["p99_ms"] > 5000:
        reasons.append(f"p99 {parsed['p99_ms']}ms > 5000ms")
    if cw["ddb_throttles"] > 0:
        reasons.append(f"DynamoDB throttles {cw['ddb_throttles']} > 0")
    if cw["lambda_errors_load_path"] > 0:
        reasons.append(f"Health-path Lambda errors {cw['lambda_errors_load_path']} > 0")
    if parsed["err_rate_pct"] > 5.0:
        reasons.append(f"error rate {parsed['err_rate_pct']}% > 5%")
    status = "FAIL" if reasons else "PASS"
    return status, reasons


def run_level(level: int, concurrency: int, label: str) -> dict:
    parsed = run_hey(concurrency, label)
    time.sleep(5)
    cw = {
        "lambda_conc_account": metric_max("AWS/Lambda", "ConcurrentExecutions", None, "Maximum"),
        "lambda_conc_health": metric_max(
            "AWS/Lambda",
            "ConcurrentExecutions",
            [{"Name": "FunctionName", "Value": HEALTH_FN}],
            "Maximum",
        ),
        "ddb_throttles": ddb_throttles(),
    }
    errs = lambda_errors_excluding_camera()
    cw["lambda_errors_non_camera"] = errs["non_camera"]
    cw["lambda_errors_load_path"] = errs["load_path"]
    cw["lambda_errors_detail"] = errs["by_function"]
    status, reasons = evaluate(parsed, cw)
    row = {
        "level": level,
        "concurrency": concurrency,
        "requests": N_REQUESTS,
        **parsed,
        **cw,
        "status": status,
        "fail_reasons": reasons,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    print(
        f"  RPS={parsed['rps']} success={parsed['success_pct']}% "
        f"p50={parsed['p50_ms']}ms p99={parsed['p99_ms']}ms "
        f"429={parsed['n429']} 5xx={parsed['n5xx']} "
        f"L-conc(acct/health)={cw['lambda_conc_account']}/{cw['lambda_conc_health']} "
        f"DDB={cw['ddb_throttles']} bg-lambda-err={cw['lambda_errors_non_camera']} "
        f"status={status}",
        flush=True,
    )
    if reasons:
        print("  STOP:", "; ".join(reasons), flush=True)
    if cw["lambda_errors_detail"]:
        print("  lambda errors:", cw["lambda_errors_detail"], flush=True)
    return row


def main() -> None:
    results: list[dict] = []
    breaking = None
    last_pass = None

    print("HEALTH_URL", HEALTH_URL, flush=True)
    print(
        "Note: stop on health-path 5xx/p99/DDB/HealthFunction errors or >5% non-2xx. "
        "Background Rapid IQ errors are recorded, not a ramp stop.",
        flush=True,
    )
    for i, c in enumerate(LEVELS, start=1):
        row = run_level(i, c, f"level-{i:02d}-c{c}")
        results.append(row)
        (ROOT / "results.json").write_text(json.dumps(results, indent=2))
        if row["status"] == "PASS":
            last_pass = row
        else:
            breaking = row
            break
        if i < len(LEVELS):
            print("  cooling 30s...", flush=True)
            time.sleep(30)

    if breaking and last_pass:
        lo = int(last_pass["concurrency"])
        hi = int(breaking["concurrency"])
        backoff = sorted({int(lo + (hi - lo) * s) for s in (0.25, 0.5, 0.75)} - {lo, hi})
        backoff = [c for c in backoff if lo < c < hi]
        extra_n = 0
        for c in backoff:
            extra_n += 1
            print("  cooling 30s before backoff...", flush=True)
            time.sleep(30)
            row = run_level(100 + extra_n, c, f"backoff-{extra_n:02d}-c{c}")
            results.append(row)
            (ROOT / "results.json").write_text(json.dumps(results, indent=2))
            if row["status"] == "PASS":
                last_pass = row
            else:
                breaking = row
                break

    summary = {
        "api_url": API_URL,
        "health_url": HEALTH_URL,
        "levels": results,
        "last_pass": last_pass,
        "breaking": breaking,
    }
    (ROOT / "results.json").write_text(json.dumps(summary, indent=2))
    print("Wrote", ROOT / "results.json", flush=True)


if __name__ == "__main__":
    main()
