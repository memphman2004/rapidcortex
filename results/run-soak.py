#!/usr/bin/env python3
"""60-minute soak against GET /api/health with 5-minute CloudWatch polls."""
from __future__ import annotations

import json
import os
import signal
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path("/Volumes/Mac Mini/Coding Projects/Rapid Cortex/results")
ROOT.mkdir(parents=True, exist_ok=True)

API_URL = os.environ.get("API_URL", "https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com").rstrip("/")
HEALTH_URL = f"{API_URL}/api/health"
API_ID = os.environ.get("HTTP_API_ID", "k26yw4o3xk")
PROFILE = os.environ.get("AWS_PROFILE", "rapid-cortex")
REGION = os.environ.get("AWS_REGION", "us-east-1")
SOAK_CONCURRENCY = int(os.environ.get("SOAK_CONCURRENCY", "88"))  # 70% of 125
DURATION_S = int(os.environ.get("DURATION", "3600"))
INTERVALS = int(os.environ.get("INTERVALS", "12"))
SLEEP_S = int(os.environ.get("INTERVAL_SLEEP", "300"))
HEALTH_FN = "rapid-cortex-dev-AppSamStackV2-1BR5-HealthFunction-7ntwCgRvu0zE"
ECS_CLUSTER = "rapid-cortex-v2-web-prod"
ECS_SERVICE = "rapid-cortex-v2-web-prod"
RAW = ROOT / "soak-raw.txt"
INTERVALS_PATH = ROOT / "soak-intervals.json"

SAMPLE_N = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def aws_json(args: list[str]) -> dict | None:
    cmd = ["aws", *args, "--profile", PROFILE, "--region", REGION, "--output", "json"]
    try:
        raw = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT)
        return json.loads(raw) if raw.strip() else None
    except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("AWS error:", getattr(exc, "output", exc), flush=True)
        return None


def metric_stats(
    namespace: str,
    metric: str,
    start: str,
    end: str,
    statistics: list[str],
    dimensions: list[str] | None = None,
    extended: list[str] | None = None,
) -> list[dict]:
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
        "300",
    ]
    if statistics:
        args.extend(["--statistics", *statistics])
    if extended:
        args.extend(["--extended-statistics", *extended])
    if dimensions:
        args.extend(["--dimensions", *dimensions])
    data = aws_json(args) or {}
    return sorted(data.get("Datapoints") or [], key=lambda p: p.get("Timestamp", ""))


def last_vals(pts: list[dict], keys: list[str]) -> dict:
    if not pts:
        return {k: None for k in keys}
    p = pts[-1]
    out = {}
    for k in keys:
        if k == "p99":
            out[k] = (p.get("ExtendedStatistics") or {}).get("p99")
        else:
            out[k] = p.get(k)
    return out


def ddb_throttles(start: str, end: str) -> float:
    query = json.dumps(
        [
            {
                "Id": "t",
                "Expression": "SUM(SEARCH('{AWS/DynamoDB,TableName} MetricName=\"ThrottledRequests\" TableName=rapid-cortex', 'Sum', 60))",
                "Period": 300,
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


def lambda_errors_split(start: str, end: str) -> dict:
    query = json.dumps(
        [
            {
                "Id": "errs",
                "Expression": "SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Errors\" FunctionName=rapid-cortex-dev', 'Sum', 300)",
                "Period": 300,
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
    health = 0.0
    other = 0.0
    detail = []
    for r in (data or {}).get("MetricDataResults") or []:
        label = r.get("Label") or ""
        s = float(sum(r.get("Values") or []))
        if s <= 0:
            continue
        detail.append({"label": label, "sum": s})
        if "HealthFunction" in label and "AppSamStackV2" in label:
            health += s
        elif "CameraHeartbeat" not in label:
            other += s
    detail.sort(key=lambda x: x["sum"], reverse=True)
    return {"health": health, "other_non_camera": other, "detail": detail[:8]}


def sample_health(n: int = SAMPLE_N) -> dict:
    statuses: dict[str, int] = {}
    times: list[float] = []
    for _ in range(n):
        t0 = time.perf_counter()
        status = "0"
        try:
            req = urllib.request.Request(HEALTH_URL, headers={"User-Agent": "rc-soak-sample/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                status = str(resp.status)
                resp.read()
        except urllib.error.HTTPError as exc:
            status = str(exc.code)
            try:
                exc.read()
            except Exception:
                pass
        except Exception:
            status = "0"
        times.append((time.perf_counter() - t0) * 1000.0)
        statuses[status] = statuses.get(status, 0) + 1
    times.sort()
    p99 = times[int((len(times) - 1) * 0.99)] if times else None
    ok = sum(v for k, v in statuses.items() if k.startswith("2"))
    n5 = sum(v for k, v in statuses.items() if k.startswith("5"))
    return {
        "n": n,
        "statuses": statuses,
        "success_pct": round(100.0 * ok / n, 2) if n else 0,
        "n429": statuses.get("429", 0),
        "n5xx": n5,
        "p99_ms": round(p99, 2) if p99 is not None else None,
    }


def poll_interval(n: int) -> dict:
    end = utc_now()
    start = end - timedelta(minutes=6)
    start_s = start.strftime("%Y-%m-%dT%H:%M:%S")
    end_s = end.strftime("%Y-%m-%dT%H:%M:%S")

    lat = metric_stats(
        "AWS/ApiGateway",
        "Latency",
        start_s,
        end_s,
        ["Average", "Maximum"],
        [f"Name=ApiId,Value={API_ID}"],
        ["p99"],
    )
    integ = metric_stats(
        "AWS/ApiGateway",
        "IntegrationLatency",
        start_s,
        end_s,
        ["Average", "Maximum"],
        [f"Name=ApiId,Value={API_ID}"],
        ["p99"],
    )
    count = metric_stats(
        "AWS/ApiGateway",
        "Count",
        start_s,
        end_s,
        ["Sum"],
        [f"Name=ApiId,Value={API_ID}"],
    )
    c4 = metric_stats(
        "AWS/ApiGateway",
        "4xx",
        start_s,
        end_s,
        ["Sum"],
        [f"Name=ApiId,Value={API_ID}"],
    )
    c5 = metric_stats(
        "AWS/ApiGateway",
        "5xx",
        start_s,
        end_s,
        ["Sum"],
        [f"Name=ApiId,Value={API_ID}"],
    )
    lam_err_acct = metric_stats("AWS/Lambda", "Errors", start_s, end_s, ["Sum"])
    lam_conc_acct = metric_stats(
        "AWS/Lambda", "ConcurrentExecutions", start_s, end_s, ["Average", "Maximum"]
    )
    lam_conc_health = metric_stats(
        "AWS/Lambda",
        "ConcurrentExecutions",
        start_s,
        end_s,
        ["Average", "Maximum"],
        [f"Name=FunctionName,Value={HEALTH_FN}"],
    )
    ecs_cpu = metric_stats(
        "AWS/ECS",
        "CPUUtilization",
        start_s,
        end_s,
        ["Average", "Maximum"],
        [f"Name=ClusterName,Value={ECS_CLUSTER}", f"Name=ServiceName,Value={ECS_SERVICE}"],
    )
    ecs_mem = metric_stats(
        "AWS/ECS",
        "MemoryUtilization",
        start_s,
        end_s,
        ["Average", "Maximum"],
        [f"Name=ClusterName,Value={ECS_CLUSTER}", f"Name=ServiceName,Value={ECS_SERVICE}"],
    )
    errs = lambda_errors_split(start_s, end_s)
    sample = sample_health()
    ddb = ddb_throttles(start_s, end_s)

    lat_last = last_vals(lat, ["Average", "Maximum", "p99"])
    integ_last = last_vals(integ, ["Average", "Maximum", "p99"])
    row = {
        "interval": n,
        "ts": end.isoformat(),
        "window_start": start_s,
        "window_end": end_s,
        "api_latency_avg_ms": lat_last.get("Average"),
        "api_latency_p99_ms": lat_last.get("p99"),
        "api_integ_p99_ms": integ_last.get("p99"),
        "apigw_count": last_vals(count, ["Sum"]).get("Sum"),
        "apigw_4xx": last_vals(c4, ["Sum"]).get("Sum"),
        "apigw_5xx": last_vals(c5, ["Sum"]).get("Sum"),
        "lambda_errors_account": last_vals(lam_err_acct, ["Sum"]).get("Sum"),
        "lambda_errors_health": errs["health"],
        "lambda_errors_other": errs["other_non_camera"],
        "lambda_errors_detail": errs["detail"],
        "lambda_conc_acct_avg": last_vals(lam_conc_acct, ["Average", "Maximum"]).get("Average"),
        "lambda_conc_acct_max": last_vals(lam_conc_acct, ["Average", "Maximum"]).get("Maximum"),
        "lambda_conc_health_avg": last_vals(lam_conc_health, ["Average", "Maximum"]).get("Average"),
        "lambda_conc_health_max": last_vals(lam_conc_health, ["Average", "Maximum"]).get("Maximum"),
        "ddb_throttles": ddb,
        "ecs_cpu_avg": last_vals(ecs_cpu, ["Average", "Maximum"]).get("Average"),
        "ecs_cpu_max": last_vals(ecs_cpu, ["Average", "Maximum"]).get("Maximum"),
        "ecs_mem_avg": last_vals(ecs_mem, ["Average", "Maximum"]).get("Average"),
        "ecs_mem_max": last_vals(ecs_mem, ["Average", "Maximum"]).get("Maximum"),
        "sample": sample,
        "hey_non2xx_in_raw": False,
    }
    try:
        text = RAW.read_text() if RAW.exists() else ""
        row["hey_non2xx_in_raw"] = "Non-2xx" in text or "[429]" in text or "[500]" in text
    except OSError:
        pass
    return row


def main() -> None:
    print(
        f"SOAK start {utc_now().isoformat()}  c={SOAK_CONCURRENCY}  z={DURATION_S}s  {HEALTH_URL}",
        flush=True,
    )
    RAW.write_text("")
    hey_cmd = [
        "hey",
        "-z",
        f"{DURATION_S}s",
        "-c",
        str(SOAK_CONCURRENCY),
        "-q",
        "0",
        HEALTH_URL,
    ]
    with RAW.open("w") as raw_fh:
        proc = subprocess.Popen(
            hey_cmd,
            stdout=raw_fh,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    print(f"Soak test running. PID: {proc.pid}", flush=True)
    print(f"Started at: {utc_now().strftime('%Y-%m-%d %H:%M:%SZ')}", flush=True)

    rows: list[dict] = []
    stopped_early = None
    try:
        for i in range(1, INTERVALS + 1):
            time.sleep(SLEEP_S)
            print(f"\n=== INTERVAL {i} ({utc_now().strftime('%Y-%m-%d %H:%M:%SZ')}) ===", flush=True)
            if proc.poll() is not None:
                print(f"WARNING: hey exited early code={proc.returncode}", flush=True)
            row = poll_interval(i)
            rows.append(row)
            INTERVALS_PATH.write_text(json.dumps(rows, indent=2, default=str))
            print(
                json.dumps(
                    {
                        "interval": i,
                        "api_p99": row["api_latency_p99_ms"],
                        "apigw_4xx": row["apigw_4xx"],
                        "apigw_5xx": row["apigw_5xx"],
                        "health_err": row["lambda_errors_health"],
                        "lam_conc_max": row["lambda_conc_health_max"],
                        "ddb": row["ddb_throttles"],
                        "ecs_cpu_max": row["ecs_cpu_max"],
                        "sample": row["sample"],
                    },
                    default=str,
                ),
                flush=True,
            )
            if row["hey_non2xx_in_raw"]:
                print("WARNING: Non-2xx responses detected — check soak-raw.txt", flush=True)
            sample = row["sample"]
            if sample["n5xx"] / sample["n"] * 100 > 1:
                stopped_early = f"sample 5xx {sample['n5xx']}/{sample['n']}"
            if (row["apigw_5xx"] or 0) > 0 and (row["apigw_count"] or 0) > 0:
                if row["apigw_5xx"] / row["apigw_count"] * 100 > 1:
                    stopped_early = f"APIGW 5xx {row['apigw_5xx']}/{row['apigw_count']}"
            if row["ddb_throttles"] > 0:
                stopped_early = f"DDB throttles {row['ddb_throttles']}"
            if row["lambda_errors_health"] > 0:
                stopped_early = f"HealthFunction errors {row['lambda_errors_health']}"
            if stopped_early:
                print("EARLY STOP:", stopped_early, flush=True)
                break
    finally:
        if proc.poll() is None:
            if stopped_early:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                try:
                    proc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            else:
                proc.wait()
        print(f"Soak test complete at: {utc_now().strftime('%Y-%m-%d %H:%M:%SZ')}", flush=True)
        print(f"hey exit={proc.returncode}", flush=True)

    summary = {
        "started": True,
        "concurrency": SOAK_CONCURRENCY,
        "duration_s": DURATION_S,
        "health_url": HEALTH_URL,
        "api_id": API_ID,
        "stopped_early": stopped_early,
        "hey_exit": proc.returncode,
        "intervals": rows,
    }
    (ROOT / "soak-summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print("Wrote", ROOT / "soak-summary.json", flush=True)


if __name__ == "__main__":
    main()
