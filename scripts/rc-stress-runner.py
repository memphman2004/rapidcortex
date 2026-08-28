#!/usr/bin/env python3
"""
Rapid Cortex — Stress Test Runner  (rc-stress-runner.py)

k6 engine: scripts/perf/rc-stress-v2.js (ramping-arrival-rate, 400/700 RPS).
This runner: preflight, API GW ID lookup, CloudWatch poll, SIGTERM on SLA
breach, PDF-compatible load-run + cloudwatch-snapshot logs.

Usage:
  python3 scripts/rc-stress-runner.py \\
    --api-url https://<id>.execute-api.us-east-1.amazonaws.com \\
    --bearer-token <cognito-id-token> \\
    --stack-name rapid-cortex-staging \\
    --stage staging

  DRY_RUN=1 python3 scripts/rc-stress-runner.py --api-url https://...

Refuses api.rapidcortex.us / app.rapidcortex.us unless RC_ALLOW_PROD_STRESS=1.
CAD write-back is not exercised (GET-only mix).
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DEFAULT_K6_SCRIPT = "scripts/perf/rc-stress-v2.js"
DEFAULT_STACK = "rapid-cortex-staging"
DEFAULT_STAGE = "staging"
DEFAULT_RESULTS = "results/stress-v2"
CW_POLL_S = 60
PREFLIGHT_TIMEOUT = 10.0

K6_EXIT_OK = 0
K6_EXIT_THRESHOLD = 99

PROD_HOST_MARKERS = (
    "api.rapidcortex.us",
    "app.rapidcortex.us",
    "www.rapidcortex.us",
)


class SLABreach(Exception):
    pass


def is_prod_api_url(api_url: str) -> bool:
    host = (urlparse(api_url).hostname or api_url).lower()
    return any(marker in host for marker in PROD_HOST_MARKERS) or host.endswith(
        ".cloudfront.net"
    )


def api_id_from_url(api_url: str) -> str:
    host = urlparse(api_url).hostname or ""
    if ".execute-api." in host:
        return host.split(".")[0]
    return ""


def aws_cmd(args: list[str], profile: str, region: str) -> Any:
    cmd = ["aws", *args, "--region", region, "--output", "json"]
    if profile:
        cmd.extend(["--profile", profile])
    try:
        raw = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, timeout=20)
        return json.loads(raw) if raw.strip() else None
    except Exception:
        return None


def cw_window(minutes: int = 3) -> tuple[str, str]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutes)
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    return start.strftime(fmt), end.strftime(fmt)


def pull_cw(api_id: str, stack_name: str, profile: str, region: str) -> dict:
    start, end = cw_window(3)
    result: dict[str, Any] = {"ts": datetime.now(timezone.utc).isoformat()}

    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-statistics",
            "--namespace",
            "AWS/ApiGateway",
            "--metric-name",
            "5XXError",
            "--dimensions",
            f"Name=ApiId,Value={api_id}",
            "--start-time",
            start,
            "--end-time",
            end,
            "--period",
            "60",
            "--statistics",
            "Sum",
        ],
        profile,
        region,
    )
    pts = (d or {}).get("Datapoints") or []
    result["gw_5xx"] = sum(p.get("Sum", 0) for p in pts)

    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-statistics",
            "--namespace",
            "AWS/ApiGateway",
            "--metric-name",
            "4XXError",
            "--dimensions",
            f"Name=ApiId,Value={api_id}",
            "--start-time",
            start,
            "--end-time",
            end,
            "--period",
            "60",
            "--statistics",
            "Sum",
        ],
        profile,
        region,
    )
    pts = (d or {}).get("Datapoints") or []
    result["gw_4xx"] = sum(p.get("Sum", 0) for p in pts)

    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-statistics",
            "--namespace",
            "AWS/ApiGateway",
            "--metric-name",
            "Latency",
            "--dimensions",
            f"Name=ApiId,Value={api_id}",
            "--start-time",
            start,
            "--end-time",
            end,
            "--period",
            "60",
            "--extended-statistics",
            "p99",
        ],
        profile,
        region,
    )
    pts = (d or {}).get("Datapoints") or []
    p99s = [p.get("ExtendedStatistics", {}).get("p99", 0) for p in pts]
    result["gw_lat_p99_ms"] = round(max(p99s) if p99s else 0, 2)

    # Nested SAM functions are named {stack}-AppSam…-Function-…
    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-data",
            "--start-time",
            start,
            "--end-time",
            end,
            "--metric-data-queries",
            json.dumps(
                [
                    {
                        "Id": "errs",
                        "Expression": (
                            "SEARCH('{"
                            "AWS/Lambda,FunctionName} MetricName=\"Errors\" "
                            f'FunctionName="{stack_name}*"\', \'Sum\', 60)'
                        ),
                        "ReturnData": True,
                    }
                ]
            ),
        ],
        profile,
        region,
    )
    lambda_errs = 0.0
    for r in (d or {}).get("MetricDataResults") or []:
        lambda_errs += sum(r.get("Values") or [])
    result["lambda_errors"] = lambda_errs

    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-statistics",
            "--namespace",
            "AWS/Lambda",
            "--metric-name",
            "ConcurrentExecutions",
            "--start-time",
            start,
            "--end-time",
            end,
            "--period",
            "60",
            "--statistics",
            "Maximum",
        ],
        profile,
        region,
    )
    pts = (d or {}).get("Datapoints") or []
    result["lambda_concurrency"] = max((p.get("Maximum", 0) for p in pts), default=0)

    d = aws_cmd(
        [
            "cloudwatch",
            "get-metric-data",
            "--start-time",
            start,
            "--end-time",
            end,
            "--metric-data-queries",
            json.dumps(
                [
                    {
                        "Id": "t",
                        "Expression": (
                            "SEARCH('{"
                            "AWS/DynamoDB,TableName} MetricName=\"ThrottledRequests\" "
                            'TableName="rapid-cortex-"\', \'Sum\', 60)'
                        ),
                        "ReturnData": True,
                    }
                ]
            ),
        ],
        profile,
        region,
    )
    ddb_t = 0.0
    for r in (d or {}).get("MetricDataResults") or []:
        ddb_t += sum(r.get("Values") or [])
    result["ddb_throttles"] = ddb_t

    return result


def check_sla(cw: dict, consecutive_warn: int) -> int:
    if cw.get("gw_5xx", 0) > 0:
        raise SLABreach(f"API GW 5xx = {cw['gw_5xx']:.0f}")
    if cw.get("ddb_throttles", 0) > 0:
        raise SLABreach(f"DynamoDB throttles = {cw['ddb_throttles']:.0f}")
    if cw.get("lambda_errors", 0) > 0:
        raise SLABreach(f"Lambda errors = {cw['lambda_errors']:.0f}")

    warn = []
    if cw.get("gw_lat_p99_ms", 0) > 2000:
        warn.append(f"API GW p99={cw['gw_lat_p99_ms']}ms > 2000ms")

    if warn:
        new_count = consecutive_warn + 1
        print(f"  [CW WARN {new_count}/2] {'; '.join(warn)}", flush=True)
        if new_count >= 2:
            raise SLABreach(f"Consecutive latency warnings: {'; '.join(warn)}")
        return new_count

    return 0


def lookup_api_id(stack_name: str, profile: str, region: str) -> str:
    d = aws_cmd(
        [
            "cloudformation",
            "describe-stacks",
            "--stack-name",
            stack_name,
            "--query",
            "Stacks[0].Outputs",
        ],
        profile,
        region,
    )
    for out in d or []:
        key = out.get("OutputKey", "")
        val = out.get("OutputValue", "")
        if key in {"HttpApiId", "HttpApi5Id", "HttpApiUrl"} or (
            "HttpApiId" in key and val and "execute-api" not in val
        ):
            if "execute-api" in val:
                return api_id_from_url(val)
            if key.endswith("Id") and val and "/" not in val:
                return val
        if "HttpApiUrl" in key and "execute-api" in val:
            return api_id_from_url(val)
    return ""


def preflight(api_url: str) -> None:
    url = f"{api_url}/api/health"
    print(f"  Preflight: GET {url} ...", flush=True)
    t0 = time.perf_counter()
    status = 0
    try:
        req = Request(url, method="GET", headers={"User-Agent": "rc-stress-runner/preflight"})
        with urlopen(req, timeout=PREFLIGHT_TIMEOUT) as resp:
            status = int(resp.status)
            resp.read()
    except HTTPError as exc:
        status = int(exc.code)
    except Exception as exc:
        print(f"  PREFLIGHT ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    ms = (time.perf_counter() - t0) * 1000
    if 200 <= status < 300:
        print(f"  Preflight OK: {status} in {ms:.0f}ms\n", flush=True)
    else:
        print(f"  PREFLIGHT FAILED: HTTP {status} in {ms:.0f}ms", file=sys.stderr)
        sys.exit(1)


def check_k6() -> str:
    try:
        out = subprocess.check_output(["k6", "version"], text=True, stderr=subprocess.STDOUT)
        return out.strip().split("\n")[0]
    except FileNotFoundError:
        print("ERROR: k6 not found. Install: brew install k6", file=sys.stderr)
        sys.exit(1)


def run_k6(
    script: str,
    api_url: str,
    bearer_token: str,
    results_dir: Path,
    json_out: bool,
) -> tuple[subprocess.Popen, Any]:
    results_dir.mkdir(parents=True, exist_ok=True)
    env = {
        **os.environ,
        "API_URL": api_url,
        "API_BASE": api_url,
        "BEARER_TOKEN": bearer_token,
        "RESULTS_DIR": str(results_dir),
    }

    cmd = ["k6", "run", script]
    if json_out:
        cmd[2:2] = ["--out", f"json={results_dir}/k6-metrics.json"]

    log_path = results_dir / "k6-stdout.log"
    log_file = open(log_path, "w", encoding="utf-8")

    print(f"  k6 command : {' '.join(cmd)}", flush=True)
    print(f"  k6 log     : {log_path}", flush=True)

    proc = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    return proc, log_file


def stream_k6_output(proc: subprocess.Popen, log_file) -> None:
    try:
        for line in proc.stdout or []:
            log_file.write(line)
            log_file.flush()
            stripped = line.rstrip()
            if stripped and not stripped.startswith('{"metric"'):
                print(f"  [k6] {stripped}", flush=True)
    except Exception:
        pass
    finally:
        log_file.close()


def read_k6_summary(results_dir: Path) -> dict:
    summary_path = results_dir / "k6-summary.json"
    if summary_path.exists():
        try:
            return json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def extract_k6_metrics(summary: dict) -> dict:
    m = summary.get("metrics", {})

    def val(metric: str, stat: str, default: float = 0.0) -> float:
        return float((m.get(metric) or {}).get("values", {}).get(stat, default))

    return {
        "total_reqs": int(val("http_reqs", "count")),
        "fail_rate_pct": round(val("http_req_failed", "rate") * 100, 2),
        "p50_ms": round(val("http_req_duration", "p(50)"), 2),
        "p90_ms": round(val("http_req_duration", "p(90)"), 2),
        "p95_ms": round(val("http_req_duration", "p(95)"), 2),
        "p99_ms": round(val("http_req_duration", "p(99)"), 2),
        "avg_ms": round(val("http_req_duration", "avg"), 2),
        "server_errors": int(val("server_errors", "count")),
        "auth_errors": int(val("auth_errors", "count")),
        "health_p99": round(val("health_latency", "p(99)"), 2),
        "agency_p99": round(val("agency_latency", "p(99)"), 2),
        "me_p99": round(val("me_latency", "p(99)"), 2),
        "breaches": [
            name
            for name, mv in m.items()
            if isinstance(mv, dict)
            and any(not t.get("ok", True) for t in (mv.get("thresholds") or {}).values())
        ],
    }


def cw_monitor_thread(
    api_id: str,
    stack_name: str,
    profile: str,
    region: str,
    k6_proc: subprocess.Popen,
    cw_intervals: list,
    abort_state: dict,
    stop_event: threading.Event,
    skip_cw: bool,
) -> None:
    if skip_cw or not api_id:
        print("  [CW] Monitoring disabled (--skip-cw or no API ID).", flush=True)
        return

    consecutive_warn = 0
    while not stop_event.is_set():
        stop_event.wait(timeout=CW_POLL_S)
        if stop_event.is_set():
            break
        if k6_proc.poll() is not None:
            break

        try:
            cw = pull_cw(api_id, stack_name, profile, region)
            cw_intervals.append(cw)
            print(
                f"  [CW] 5xx={cw['gw_5xx']:.0f}  4xx={cw['gw_4xx']:.0f}  "
                f"lat_p99={cw['gw_lat_p99_ms']:.0f}ms  "
                f"lambda_err={cw['lambda_errors']:.0f}  "
                f"ddb_throttles={cw['ddb_throttles']:.0f}  "
                f"lambda_conc={cw['lambda_concurrency']:.0f}",
                flush=True,
            )
            consecutive_warn = check_sla(cw, consecutive_warn)
        except SLABreach as e:
            abort_state["triggered"] = True
            abort_state["reason"] = str(e)
            print(f"\n  SLA BREACH — terminating k6: {e}", flush=True)
            try:
                k6_proc.terminate()
            except Exception:
                pass
            stop_event.set()
            break
        except Exception as exc:
            print(f"  [CW] Poll error (continuing): {exc}", flush=True)


def write_report(
    results_dir: Path,
    k6_metrics: dict,
    cw_intervals: list,
    api_url: str,
    stage: str,
    start_ts: str,
    end_ts: str,
    verdict: str,
    abort_reason: str | None,
    k6_exit_code: int,
) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    summary = {
        "test": "rc-stress-runner (k6 v2 + CloudWatch)",
        "stage": stage,
        "api_url": api_url,
        "start_ts": start_ts,
        "end_ts": end_ts,
        "verdict": verdict,
        "abort_reason": abort_reason,
        "k6_exit_code": k6_exit_code,
        "k6_metrics": k6_metrics,
        "cloudwatch": cw_intervals,
        "threshold_breaches": k6_metrics.get("breaches", []),
    }

    out_path = results_dir / f"stress-runner-{ts}.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    check_sym = "✓" if verdict == "PASS" else "✗"
    log_lines = [
        f"rc-stress-runner  stage={stage}  api={api_url}",
        f"verdict={verdict}  k6_exit={k6_exit_code}",
        f"start={start_ts}  end={end_ts}",
        "",
        f"  http_req_duration  avg={k6_metrics.get('avg_ms', 0):.0f}ms  "
        f"p(90)={k6_metrics.get('p90_ms', 0):.0f}ms  "
        f"p(95)={k6_metrics.get('p95_ms', 0):.0f}ms  "
        f"p(99)={k6_metrics.get('p99_ms', 0):.0f}ms",
        f"  http_req_failed    {k6_metrics.get('fail_rate_pct', 0):.2f}%",
        f"  http_reqs          {k6_metrics.get('total_reqs', 0)}",
        f"  {check_sym} http_req_duration < 500ms",
        f"  {check_sym} http_req_failed < 2%",
        f"  {check_sym} server_errors count = 0",
    ]
    if abort_reason:
        log_lines.append(f"ERRO thresholds on metrics have been crossed ({abort_reason})")
    for breach in k6_metrics.get("breaches", []):
        log_lines.append(f"  ✗ THRESHOLD BREACH: {breach}")

    stdout_src = results_dir / "k6-stdout.log"
    stdout_txt = stdout_src.read_text(encoding="utf-8", errors="replace") if stdout_src.exists() else ""
    load_log = "\n".join(log_lines) + ("\n\n" + stdout_txt if stdout_txt else "")
    # PDF generator reads load-run-*.log (capacity test, not smoke).
    (results_dir / f"load-run-{ts}.log").write_text(load_log, encoding="utf-8")
    (results_dir / f"stress-v2-run-{ts}.log").write_text(load_log, encoding="utf-8")

    last_cw = cw_intervals[-1] if cw_intervals else {}
    cw_lines = [
        f"5xx errors: {last_cw.get('gw_5xx', 'N/A')}",
        f"4xx errors: {last_cw.get('gw_4xx', 'N/A')}",
        f"Latency p99: {last_cw.get('gw_lat_p99_ms', 'N/A')}",
        "CPU utilization: N/A",
        "Memory utilization: N/A",
        f"5xx error rate: {round(last_cw.get('gw_5xx', 0) / max(1, 80) * 100, 3)}",
        f"Lambda Errors: {last_cw.get('lambda_errors', 'N/A')} |",
        f"R-Throttles: {int(last_cw.get('ddb_throttles', 0))}",
        "✓ No throttles" if last_cw.get("ddb_throttles", 0) == 0 else "⚠ Throttles detected",
    ]
    cw_path = results_dir / f"cloudwatch-snapshot-{ts}.txt"
    cw_path.write_text("\n".join(cw_lines), encoding="utf-8")

    print(f"\n  Results  : {out_path}", flush=True)
    print(f"  Load log : {results_dir / f'load-run-{ts}.log'}", flush=True)
    print(f"  CW snap  : {cw_path}", flush=True)
    return out_path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Rapid Cortex Stress Test Runner — k6 v2 + CloudWatch",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--api-url", default=os.environ.get("API_URL") or os.environ.get("API_BASE", ""))
    p.add_argument("--bearer-token", default=os.environ.get("BEARER_TOKEN", ""))
    p.add_argument("--k6-script", default=os.environ.get("K6_SCRIPT", DEFAULT_K6_SCRIPT))
    p.add_argument("--stack-name", default=os.environ.get("STACK_NAME", DEFAULT_STACK))
    p.add_argument("--stage", default=os.environ.get("STAGE", DEFAULT_STAGE))
    p.add_argument("--results-dir", default=os.environ.get("RESULTS_DIR", DEFAULT_RESULTS))
    p.add_argument("--api-id", default=os.environ.get("HTTP_API_ID", ""))
    p.add_argument("--profile", default=os.environ.get("AWS_PROFILE", "rapid-cortex"))
    p.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    p.add_argument(
        "--dry-run",
        action="store_true",
        default=os.environ.get("DRY_RUN", "0") == "1",
    )
    p.add_argument(
        "--skip-cw",
        action="store_true",
        default=os.environ.get("SKIP_CW", "0") == "1",
    )
    p.add_argument(
        "--k6-json-out",
        action="store_true",
        default=os.environ.get("K6_JSON_OUT", "0") == "1",
        help="Write k6 --out json (very large at 400 RPS; off by default)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if not args.api_url:
        print("ERROR: --api-url or API_URL / API_BASE is required.", file=sys.stderr)
        sys.exit(1)

    api_url = args.api_url.rstrip("/")
    if is_prod_api_url(api_url) and os.environ.get("RC_ALLOW_PROD_STRESS", "0") != "1":
        print(
            "ERROR: refusing capacity test against a production host.\n"
            "  Set RC_ALLOW_PROD_STRESS=1 to override, or use the staging API URL.",
            file=sys.stderr,
        )
        sys.exit(2)

    results_dir = Path(args.results_dir)
    k6_script = args.k6_script

    if not Path(k6_script).exists():
        print(f"ERROR: k6 script not found: {k6_script}", file=sys.stderr)
        sys.exit(1)

    k6_version = check_k6() if not args.dry_run else "k6 (dry-run — not checked)"

    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Rapid Cortex — Stress Test Runner                      ║")
    print("║  k6 v2 (500 RPS / 1000 burst) + CloudWatch SLA          ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"  k6 version : {k6_version}")
    print(f"  k6 script  : {k6_script}")
    print(f"  API URL    : {api_url}")
    print(f"  Stage      : {args.stage}")
    print(f"  Stack      : {args.stack_name}")
    print(
        f"  Auth       : {'YES — bearer token set' if args.bearer_token else 'NO — auth endpoints will 401'}"
    )
    print(f"  CW monitor : {'DISABLED (--skip-cw)' if args.skip_cw else 'ENABLED (60s poll)'}")
    print(f"  Results    : {results_dir}")
    print()
    print("  SCENARIO: warmup → 400 rps hold 10m → spike 700 rps (429s expected)")
    print("  ABORT: API GW 5xx > 0 | DDB throttles > 0 | Lambda errors > 0 | p99 > 2s × 2")
    print()

    if args.dry_run:
        print("DRY RUN — no traffic sent, no AWS calls made.")
        return

    api_id = args.api_id or api_id_from_url(api_url)
    if not api_id and not args.skip_cw:
        print(f"  Looking up API GW ID from stack {args.stack_name}...", flush=True)
        api_id = lookup_api_id(args.stack_name, args.profile, args.region)
        if api_id:
            print(f"  API GW ID  : {api_id}", flush=True)
        else:
            print("  WARNING: Could not detect API GW ID — CW metrics will be empty.", flush=True)

    preflight(api_url)

    cw_intervals: list[dict] = []
    abort_state: dict[str, Any] = {"triggered": False, "reason": None}
    stop_event = threading.Event()
    start_ts = datetime.now(timezone.utc).isoformat()

    print("  Starting k6...\n", flush=True)
    k6_proc, log_file = run_k6(
        k6_script, api_url, args.bearer_token, results_dir, args.k6_json_out
    )

    stream_thread = threading.Thread(
        target=stream_k6_output, args=(k6_proc, log_file), daemon=True
    )
    stream_thread.start()

    cw_thread = threading.Thread(
        target=cw_monitor_thread,
        args=(
            api_id,
            args.stack_name,
            args.profile,
            args.region,
            k6_proc,
            cw_intervals,
            abort_state,
            stop_event,
            args.skip_cw,
        ),
        daemon=True,
    )
    cw_thread.start()

    def handle_sigint(sig, frame):
        print("\n  [RUNNER] SIGINT — stopping k6 and monitor...", flush=True)
        abort_state["triggered"] = True
        abort_state["reason"] = "KeyboardInterrupt"
        stop_event.set()
        try:
            k6_proc.terminate()
        except Exception:
            pass

    signal.signal(signal.SIGINT, handle_sigint)

    k6_exit_code = k6_proc.wait()
    stop_event.set()
    stream_thread.join(timeout=5)
    cw_thread.join(timeout=5)

    end_ts = datetime.now(timezone.utc).isoformat()

    if not args.skip_cw and api_id:
        try:
            final_cw = pull_cw(api_id, args.stack_name, args.profile, args.region)
            final_cw["phase"] = "final"
            cw_intervals.append(final_cw)
        except Exception:
            pass

    k6_summary = read_k6_summary(results_dir)
    k6_metrics = extract_k6_metrics(k6_summary)

    if abort_state["triggered"]:
        verdict = "FAIL"
        abort_reason = abort_state["reason"]
    elif k6_exit_code == K6_EXIT_THRESHOLD:
        verdict = "FAIL"
        abort_reason = f"k6 threshold breach: {', '.join(k6_metrics.get('breaches', ['unknown']))}"
    elif k6_exit_code != K6_EXIT_OK:
        verdict = "ERROR"
        abort_reason = f"k6 exited with code {k6_exit_code}"
    elif k6_metrics.get("server_errors", 0) > 0:
        verdict = "FAIL"
        abort_reason = f"server_errors = {k6_metrics['server_errors']} (5xx detected)"
    else:
        verdict = "PASS"
        abort_reason = None

    print("\n" + "=" * 60, flush=True)
    print(f"  VERDICT        : {verdict}", flush=True)
    if abort_reason:
        print(f"  REASON         : {abort_reason}", flush=True)
    print(f"  k6 exit code   : {k6_exit_code}", flush=True)
    print(f"  Total requests : {k6_metrics.get('total_reqs', 'N/A')}", flush=True)
    print(f"  Failure rate   : {k6_metrics.get('fail_rate_pct', 'N/A')}%", flush=True)
    print(
        f"  p50 / p99      : {k6_metrics.get('p50_ms', 'N/A')}ms / {k6_metrics.get('p99_ms', 'N/A')}ms",
        flush=True,
    )
    print(f"  Server errors  : {k6_metrics.get('server_errors', 'N/A')}", flush=True)
    print("=" * 60, flush=True)

    write_report(
        results_dir,
        k6_metrics,
        cw_intervals,
        api_url,
        args.stage,
        start_ts,
        end_ts,
        verdict,
        abort_reason,
        k6_exit_code,
    )

    print()
    print("  PDF report:")
    print(f"    python3 scripts/generate-stress-report.py --results-dir {results_dir} \\")
    print(f"      --stage {args.stage} --api-url {api_url} \\")
    print(f"      --output {results_dir}/RC_StressTest_Report_v2.pdf")

    sys.exit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
