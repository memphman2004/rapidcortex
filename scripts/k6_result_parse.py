"""Parse k6 stdout logs and handleSummary JSON for the stress PDF/HTML reports."""

from __future__ import annotations

import json
import re
from pathlib import Path


def k6_log_indicates_threshold_failure(txt: str) -> bool:
    """True only when k6 actually crossed a threshold.

    Must not match the metric name ``http_req_failed`` (always present in
    healthy runs) via a naive ``FAILED`` / ``failed`` regex.
    """
    return bool(
        re.search(
            r"thresholds on metrics .+ have been crossed",
            txt,
            re.IGNORECASE,
        )
    )


def parse_k6_log(txt: str) -> dict:
    m: dict = {}
    pats = {
        "avg": r"http_req_duration.*?avg=([\d.]+\w+)",
        "p90": r"http_req_duration.*?p\(90\)=([\d.]+\w+)",
        "p95": r"http_req_duration.*?p\(95\)=([\d.]+\w+)",
        "p99": r"http_req_duration.*?p\(99\)=([\d.]+\w+)",
        "err": r"http_req_failed.*?([\d.]+)%",
        "rps": r"http_reqs.*?\s([\d.]+)/s",
        "vus": r"vus_max\s+[\d]+\s+([\d]+)",
        "iter": r"iterations.*?\s([\d.]+)/s",
    }
    for k, p in pats.items():
        found = re.search(p, txt, re.MULTILINE | re.IGNORECASE)
        if found:
            m[k] = found.group(1)
    m["thresholds"] = re.findall(r"(✓|✗)\s+([\w_ ()]+)", txt)
    m["failed"] = k6_log_indicates_threshold_failure(txt)
    return m


def parse_k6_summary_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    sla = data.get("sla") or {}
    p95 = sla.get("api_p95_ms")
    err = sla.get("error_rate")
    m: dict = {
        "thresholds": [],
        "failed": bool(
            sla.get("error_rate_pass") is False
            or sla.get("api_p95_pass") is False
        ),
    }
    if isinstance(p95, (int, float)):
        m["p95"] = f"{p95:.0f}ms"
    if isinstance(err, (int, float)):
        m["err"] = f"{err * 100:.2f}"
    return m


def _latest_glob(directory: Path, pattern: str) -> Path | None:
    matches = sorted(p for p in directory.glob(pattern) if "latest" not in p.name)
    if matches:
        return matches[-1]
    latest_name = pattern.replace("*", "latest")
    latest = directory / latest_name
    return latest if latest.is_file() else None


def load_results(rdir: str | Path) -> dict:
    p = Path(rdir)
    d: dict = {"sm": {}, "lm": {}, "cw": {}}

    smoke_log = _latest_glob(p, "smoke-run-*.log")
    if smoke_log:
        d["sm"] = parse_k6_log(smoke_log.read_text(errors="replace"))
    else:
        smoke_json = p / "smoke" / "k6-summary.json"
        if smoke_json.is_file():
            d["sm"] = parse_k6_summary_json(smoke_json)

    load_log = _latest_glob(p, "load-run-*.log")
    if load_log:
        d["lm"] = parse_k6_log(load_log.read_text(errors="replace"))
    else:
        load_json = p / "load" / "k6-summary.json"
        if load_json.is_file():
            d["lm"] = parse_k6_summary_json(load_json)

    cl = _latest_glob(p, "cloudwatch-snapshot-*.txt")
    if cl:
        d["cw"] = parse_cw(cl.read_text(errors="replace"))
    return d


def parse_cw(txt: str) -> dict:
    cw: dict = {}
    pats = {
        "gw_5xx": r"5xx errors:\s*([\d.]+)",
        "gw_4xx": r"4xx errors:\s*([\d.]+)",
        "gw_lat": r"Latency p99:\s*([\d.]+)",
        "gw_req": r"Total requests.*?:\s*([\d.]+)",
        "ecs_cpu": r"CPU utilization:\s*([\d.]+)",
        "ecs_mem": r"Memory utilization:\s*([\d.]+)",
        "cf_5xx": r"5xx error rate:\s*([\d.]+)",
        "cf_req": r"Requests.*?:\s*([\d.]+)",
    }
    for k, pat in pats.items():
        found = re.search(pat, txt, re.MULTILINE | re.IGNORECASE)
        if found:
            cw[k] = found.group(1)
    errs = re.findall(r"Errors:\s*([\d.]+)\s*\|", txt)
    cw["lambda_errors"] = str(sum(int(float(e)) for e in errs if e not in ("N/A", "")))
    cw["dyn_throttles"] = "0" if "No throttles" in txt else "DETECTED"
    return cw
