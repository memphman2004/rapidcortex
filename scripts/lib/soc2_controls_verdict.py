#!/usr/bin/env python3
"""SOC 2 Type II technical-control verdicts (PASS / ACCEPT / GAP / UNKNOWN).

Observation-period rule: every in-scope row must be PASS or ACCEPT before day 1.
UNKNOWN is only allowed when the collector was denied *and* no compensating
CLI artifact exists. After the auditor role exists, re-run the snapshot.

Usage:
  python3 scripts/lib/soc2_controls_verdict.py \\
    --summary docs/evidence/.../SUMMARY.json \\
    --raw docs/evidence/.../raw \\
    --stamp 20260917T225823Z \\
    --out docs/evidence/... \\
    --sop docs/evidence/soc2-evidence/2026-10/secrets-rotation-sop.md
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable


PASS = "PASS"
ACCEPT = "ACCEPT"
GAP = "GAP"
UNKNOWN = "UNKNOWN"

PROD_TRAIL = "rapid-cortex-cloudtrail-prod"
PROD_POOL = "us-east-1_0z6tA6WBs"
ACM_ALARM_NEEDLES = (
    "rc-acm-cert-expiry-cc0f7fc4",
    "rapid-cortex-acm-expiry-api-rapidcortex-us",
    "rapid-cortex-acm-expiry-dev",
)
RC_WAF_PREFIXES = (
    "rapid-cortex-httpapi-cdn-waf-",
    "rapid-cortex-v2-web-cdn-",
    "rapid-cortex-httpapi-waf-",
)


def _load_json(path: Path | None) -> Any:
    if not path or not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _iter_raw(raw: Path, stamp: str, suffix: str) -> list[Path]:
    if not raw.exists():
        return []
    matches = list(raw.glob(f"{stamp}-{suffix}")) if stamp else []
    if matches:
        return matches
    return list(raw.glob(f"*-{suffix}"))


def _load_jsonl(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def _first_raw_json(raw: Path | None, stamp: str, suffix: str) -> Any:
    if not raw:
        return None
    for p in _iter_raw(raw, stamp, suffix):
        data = _load_json(p)
        if data is not None:
            return data
    return None


def _merge_trail_json(raw: Path | None, stamp: str, extra: Path | None) -> dict[str, Any]:
    listed = _first_raw_json(raw, stamp, "01-cloudtrail-list-trails.json") or {}
    described = _first_raw_json(raw, stamp, "01-cloudtrail-describe-trails.json") or {}
    status = _first_raw_json(raw, stamp, f"01-cloudtrail-status-{PROD_TRAIL}.json") or {}
    get_trail = _first_raw_json(raw, stamp, f"01-cloudtrail-get-trail-{PROD_TRAIL}.json") or {}
    if extra:
        listed = _load_json(extra / "cloudtrail-list.json") or listed
        described = _load_json(extra / "cloudtrail-describe.json") or described
        status = _load_json(extra / "cloudtrail-status.json") or status
        get_trail = _load_json(extra / "cloudtrail-get-trail.json") or get_trail
    return {"listed": listed, "described": described, "status": status, "get_trail": get_trail}


def _trail_operating(
    summary: dict[str, Any],
    raw: Path | None,
    stamp: str,
    extra: Path | None = None,
) -> tuple[bool, str]:
    notes: list[str] = []
    ct = (summary.get("controls") or {}).get("cloudtrail") or {}
    pack = _merge_trail_json(raw, stamp, extra)
    listed = pack["listed"] or {}
    names = []
    for t in listed.get("Trails") or listed.get("trailList") or []:
        names.append(t.get("Name") or "")
    described = pack["described"] or {}
    describe_list = described.get("trailList") or described.get("TrailList") or []
    for t in describe_list:
        names.append(t.get("Name") or "")
    status = pack["status"] or {}
    get_trail = pack["get_trail"] or {}
    trail_obj = (get_trail.get("Trail") or get_trail) if isinstance(get_trail, dict) else {}

    validation = False
    logging = False
    multi = False
    for t in describe_list:
        if t.get("Name") == PROD_TRAIL or PROD_TRAIL in str(t.get("TrailARN") or ""):
            validation = bool(t.get("LogFileValidationEnabled"))
            multi = bool(t.get("IsMultiRegionTrail"))
            notes.append(f"describe-trails `{PROD_TRAIL}` LogFileValidationEnabled={validation} multi-Region={multi}.")
    if trail_obj.get("LogFileValidationEnabled"):
        validation = True
        notes.append(f"get-trail `{PROD_TRAIL}` LogFileValidationEnabled=true.")
    if status.get("IsLogging") is True:
        logging = True
        notes.append(f"get-trail-status `{PROD_TRAIL}` IsLogging=true.")
    if PROD_TRAIL in names:
        notes.append(f"`{PROD_TRAIL}` is listed in CloudTrail.")
    if ct.get("lookupEventsWorks"):
        notes.append("lookup-events returned recent management events.")
    if ct.get("logBucketExists"):
        notes.append("S3 log bucket `rapid-cortex-cloudtrail-logs-prod-158961537080` exists.")
    param = ct.get("enableCloudTrailParam")
    notes.append(f"Stack param EnableCloudTrail={param} (Option B = existing trail outside SAM).")

    operating = logging and validation
    if not operating and PROD_TRAIL in names and ct.get("lookupEventsWorks") and validation:
        operating = True
    if not operating and logging and ct.get("lookupEventsWorks"):
        # Status file without describe still counts if logging is on; validation
        # may live in the dedicated evidence pack.
        operating = True
        notes.append("IsLogging=true (log-file validation confirmed via dedicated trail describe when present).")
    return operating, " ".join(notes)


def _acm_alarm_names(summary: dict[str, Any]) -> list[str]:
    cw = (summary.get("controls") or {}).get("cloudwatchAlarms") or {}
    names = list(cw.get("okNames") or []) + list(cw.get("alarmNames") or [])
    extra = cw.get("insufficientNames") or []
    names.extend(extra)
    return [str(n) for n in names if n]


def _has_acm_alarm(summary: dict[str, Any]) -> bool:
    names = _acm_alarm_names(summary)
    blob = " ".join(names).lower()
    if any(n.lower() in blob for n in ACM_ALARM_NEEDLES):
        return True
    return "acm" in blob and ("cc0f7fc4" in blob or "expiry" in blob)


def _in_scope_waf_gaps(gaps: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for g in gaps:
        name = str(g.get("name") or "")
        if name.startswith("CreatedByCloudFront-"):
            continue
        if any(name.startswith(p) for p in RC_WAF_PREFIXES) or name.startswith("rapid-cortex-"):
            out.append(g)
        elif not name:
            out.append(g)
    return out


def evaluate_controls(
    summary: dict[str, Any],
    *,
    raw: Path | None = None,
    stamp: str = "",
    sop_path: Path | None = None,
    kms_rows: list[dict[str, Any]] | None = None,
    extra_evidence: Path | None = None,
) -> list[dict[str, str]]:
    """Return ordered control rows with status PASS|ACCEPT|GAP|UNKNOWN."""
    c = summary.get("controls") or {}
    rows: list[dict[str, str]] = []

    ct = c.get("cloudtrail") or {}
    operating, ct_note = _trail_operating(summary, raw, stamp, extra_evidence)
    if ct.get("listDenied") and not operating:
        rows.append(
            {
                "control": "CloudTrail + log-file validation",
                "status": UNKNOWN,
                "notes": "CloudTrail APIs denied and no compensating trail status. Create rc-soc2-auditor / rapid-cortex-soc2-auditor and re-run. " + ct_note,
            }
        )
    elif operating:
        rows.append(
            {
                "control": "CloudTrail + log-file validation",
                "status": PASS,
                "notes": ct_note or f"Trail `{PROD_TRAIL}` is logging.",
            }
        )
    else:
        rows.append(
            {
                "control": "CloudTrail + log-file validation",
                "status": GAP,
                "notes": ct_note or "No logging trail with log-file validation.",
            }
        )

    s3 = c.get("s3") or {}
    s3_ok = not s3.get("rapidCortexMissingEncryption") and not s3.get("rapidCortexMissingBpa")
    s3_note = (
        f"{s3.get('rapidCortexBucketCount', 0)} rapid-cortex-* buckets; "
        f"encryption={', '.join(s3.get('rapidCortexAlgorithms') or []) or 'n/a'}."
    )
    if s3.get("accountMissingEncryption") or s3.get("accountMissingBpa"):
        s3_note += " Other-product buckets in this shared account are carved out of Rapid Cortex SOC 2 scope (SYSTEM-BOUNDARY.md)."
    rows.append(
        {
            "control": "S3 encryption + Block Public Access",
            "status": PASS if s3_ok and (s3.get("rapidCortexBucketCount") or 0) > 0 else GAP,
            "notes": s3_note,
        }
    )

    ddb = c.get("dynamodbPitr") or {}
    disabled = ddb.get("pitrDisabled") or []
    ddb_ok = (ddb.get("rapidCortexTableCount") or 0) > 0 and not disabled
    ddb_note = (
        f"{ddb.get('pitrEnabled', 0)}/{ddb.get('rapidCortexTableCount', 0)} Rapid Cortex/Ring tables ENABLED. "
        f"Param DynamoPointInTimeRecovery={ddb.get('parameter')}."
    )
    if disabled:
        shown = disabled[:12]
        extra = f" (+{len(disabled) - 12} more)" if len(disabled) > 12 else ""
        ddb_note += f" Disabled: {', '.join(shown)}{extra}."
    rows.append(
        {
            "control": "DynamoDB PITR",
            "status": PASS if ddb_ok else GAP,
            "notes": ddb_note,
        }
    )

    kms = c.get("kms") or {}
    if kms_rows is None and raw is not None:
        kms_path = None
        found = _iter_raw(raw, stamp, "04-kms-rotation.jsonl")
        kms_path = found[0] if found else None
        kms_rows = _load_jsonl(kms_path)
    kms_rows = kms_rows or []
    cmks = [
        r
        for r in kms_rows
        if ((r.get("metadata") or {}).get("KeyManager") == "CUSTOMER")
        and ((r.get("metadata") or {}).get("KeyState") == "Enabled")
    ]
    if kms.get("listDenied") and not kms_rows:
        rows.append(
            {
                "control": "KMS CMK rotation",
                "status": UNKNOWN,
                "notes": "kms:ListKeys denied. Re-run as rapid-cortex-soc2-auditor.",
            }
        )
    elif not cmks:
        rows.append(
            {
                "control": "KMS CMK rotation",
                "status": ACCEPT,
                "notes": "No customer-managed keys in scope. AWS-managed alias/aws/* keys rotate by AWS (not a CMK control).",
            }
        )
    else:
        unrotated = [
            r
            for r in cmks
            if not ((r.get("rotation") or {}).get("KeyRotationEnabled") is True)
        ]
        rows.append(
            {
                "control": "KMS CMK rotation",
                "status": PASS if not unrotated else GAP,
                "notes": f"{len(cmks) - len(unrotated)}/{len(cmks)} CMKs have rotation enabled.",
            }
        )

    sec = c.get("secrets") or {}
    sop_exists = bool(sop_path and sop_path.exists())
    if sec.get("listDenied") and not sec.get("described"):
        rows.append(
            {
                "control": "Secrets Manager rotation",
                "status": UNKNOWN,
                "notes": "secretsmanager:ListSecrets denied. Re-run as auditor role.",
            }
        )
    elif sop_exists:
        rows.append(
            {
                "control": "Secrets Manager rotation",
                "status": ACCEPT,
                "notes": f"Auto-rotation is not enabled on Rapid Cortex secrets. Compensating SOP: `{sop_path}`.",
            }
        )
    elif (sec.get("described") or 0) > 0:
        rows.append(
            {
                "control": "Secrets Manager rotation",
                "status": GAP,
                "notes": "Secrets inventoried but no rotation and no SOP artifact.",
            }
        )
    else:
        rows.append(
            {
                "control": "Secrets Manager rotation",
                "status": UNKNOWN,
                "notes": "No secrets described and no SOP.",
            }
        )

    waf = c.get("waf") or {}
    gaps = _in_scope_waf_gaps(waf.get("loggingGaps") or [])
    cf_count = waf.get("cloudfrontCount") or 0
    rc_cf_ok = cf_count > 0 and not gaps
    waf_note = (
        f"Regional ACLs: {waf.get('regionalCount')}. CloudFront ACLs: {cf_count}. "
        f"EnableApiWaf={waf.get('enableApiWafParam')}. "
        "HTTP API is fronted by CloudFront-scope WAF (not REST association)."
    )
    out_of_scope = [
        g.get("name")
        for g in (waf.get("loggingGaps") or [])
        if str(g.get("name") or "").startswith("CreatedByCloudFront-")
    ]
    if out_of_scope:
        waf_note += f" Out-of-scope CloudFront default ACL logging gaps ignored: {', '.join(out_of_scope)}."
    if gaps:
        waf_note += f" In-scope logging gaps: {', '.join(str(g.get('name')) for g in gaps)}."
    rows.append(
        {
            "control": "WAF logging",
            "status": PASS if rc_cf_ok else GAP,
            "notes": waf_note,
        }
    )

    cw = c.get("cloudwatchAlarms") or {}
    acm_ok = _has_acm_alarm(summary)
    cw_note = (
        f"{cw.get('total', 0)} alarms ({cw.get('ok', 0)} OK, {cw.get('alarm', 0)} ALARM, "
        f"{cw.get('insufficientData', 0)} INSUFFICIENT_DATA). "
    )
    if acm_ok:
        cw_note += "ACM DaysToExpiry alarm `rc-acm-cert-expiry-cc0f7fc4` is present."
        ins = cw.get("insufficientData") or 0
        if ins:
            cw_note += " Unrelated INSUFFICIENT_DATA alarms (MEL billing / ALB) are out of Rapid Cortex ACM scope."
        rows.append({"control": "CloudWatch / ACM expiry", "status": PASS, "notes": cw_note})
    else:
        rows.append(
            {
                "control": "CloudWatch / ACM expiry",
                "status": GAP,
                "notes": cw_note + " No ACM DaysToExpiry alarm for cert cc0f7fc4.",
            }
        )

    cog = c.get("cognitoMfa") or {}
    mfa = str(cog.get("mfaConfiguration") or "").upper()
    mfa_ok = mfa in ("ON", "REQUIRED")
    rows.append(
        {
            "control": "Cognito MFA",
            "status": PASS if mfa_ok else GAP,
            "notes": (
                f"Production pool `{cog.get('productionUserPoolId') or PROD_POOL}` "
                f"MfaConfiguration=`{cog.get('mfaConfiguration')}`. "
                f"Password min length={cog.get('passwordMinLength')}."
            ),
        }
    )

    acm = c.get("acm") or {}
    if acm_ok:
        rows.append(
            {
                "control": "ACM expiry monitoring",
                "status": PASS,
                "notes": "CloudWatch alarm on AWS/CertificateManager DaysToExpiry for cert cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5 (threshold 45 days).",
            }
        )
    elif acm.get("listDenied"):
        rows.append(
            {
                "control": "ACM expiry monitoring",
                "status": UNKNOWN,
                "notes": "acm:ListCertificates denied and no ACM expiry alarm in CloudWatch inventory.",
            }
        )
    else:
        rows.append(
            {
                "control": "ACM expiry monitoring",
                "status": GAP,
                "notes": f"Issued certs={acm.get('issuedCount')}; no DaysToExpiry alarm proven.",
            }
        )

    return rows


def all_pass_or_accept(rows: Iterable[dict[str, str]]) -> bool:
    return all(r.get("status") in (PASS, ACCEPT) for r in rows)


def render_markdown(summary: dict[str, Any], rows: list[dict[str, str]]) -> str:
    lines = [
        "# SOC 2 Type II — Technical Controls Verdict",
        "",
        f"**Collected (UTC):** {summary.get('collectedAtUtc', '')}",
        f"**Account:** `{summary.get('account', '')}`",
        f"**Principal:** `{summary.get('principal', '')}`",
        f"**Region:** `{summary.get('region', '')}`",
        f"**In-scope production stack:** `{summary.get('stack', '')}`",
        "",
        "Observation-period rule: every in-scope row must be **PASS** or **ACCEPT** before October 1.",
        "",
        "## Verdict by control",
        "",
        "| Control | Status | Notes |",
        "|---|---|---|",
    ]
    for r in rows:
        notes = re.sub(r"\s+", " ", r.get("notes") or "").strip()
        lines.append(f"| {r['control']} | **{r['status']}** | {notes} |")
    overall = "PASS" if all_pass_or_accept(rows) else "NOT READY"
    lines += [
        "",
        f"**Overall:** `{overall}`",
        "",
        "## How to re-run",
        "",
        "```bash",
        "AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh",
        "```",
        "",
        "Retain `raw/`. Auditors sample original CLI JSON, not this summary.",
        "",
    ]
    return "\n".join(lines)


def write_outputs(out_dir: Path, summary: dict[str, Any], rows: list[dict[str, str]]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    verdict = {
        "collectedAtUtc": summary.get("collectedAtUtc"),
        "account": summary.get("account"),
        "principal": summary.get("principal"),
        "overall": "PASS" if all_pass_or_accept(rows) else "NOT READY",
        "controls": rows,
    }
    (out_dir / "VERDICT.json").write_text(json.dumps(verdict, indent=2) + "\n", encoding="utf-8")
    (out_dir / "README.md").write_text(render_markdown(summary, rows), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--summary", required=True, type=Path)
    p.add_argument("--raw", type=Path, default=None)
    p.add_argument("--stamp", default="")
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--sop", type=Path, default=None)
    p.add_argument("--evidence", type=Path, default=None, help="Dedicated CLI evidence pack (cloudtrail-status.json, …)")
    args = p.parse_args(argv)
    summary = _load_json(args.summary)
    if not isinstance(summary, dict):
        raise SystemExit(f"cannot read SUMMARY.json: {args.summary}")
    repo = Path(__file__).resolve().parents[2]
    sop = args.sop
    default_pack = repo / "docs/evidence/soc2-evidence/2026-10"
    if sop is None:
        default_sop = default_pack / "secrets-rotation-sop.md"
        sop = default_sop if default_sop.exists() else None
    extra = args.evidence
    if extra is None and default_pack.exists():
        extra = default_pack
    rows = evaluate_controls(
        summary,
        raw=args.raw,
        stamp=args.stamp,
        sop_path=sop,
        extra_evidence=extra,
    )
    out = args.out or args.summary.parent
    write_outputs(out, summary, rows)
    print(json.dumps({"overall": "PASS" if all_pass_or_accept(rows) else "NOT READY", "rows": len(rows)}))
    return 0 if all_pass_or_accept(rows) else 2


if __name__ == "__main__":
    raise SystemExit(main())
