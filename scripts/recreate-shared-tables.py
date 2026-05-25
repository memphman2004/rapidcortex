#!/usr/bin/env python3
"""
Backup + recreate DynamoDB tables that are owned by a CloudFormation nested
stack you need to delete (e.g. an orphan / legacy SAM stack) but whose **table
names** are still referenced by another live stack via plain string env vars.

Recovery workflow
-----------------
This is the script we used when removing the legacy `rapid-cortex-2-dev` stack:
the prod `rapid-cortex-dev` stack referenced 12 of its tables by name only, so
deleting the stack would have dropped those tables and broken prod features
(coaching, reports, hospital, incident timeline, war rooms, SLA, etc.).

    # 1. Back up schemas + items BEFORE deleting the source stack.
    python3 scripts/recreate-shared-tables.py backup \\
        --region us-east-1 \\
        --backup-dir /tmp/rc-stack-backup \\
        --tables \\
            rapid-cortex-coaching-notes-dev \\
            rapid-cortex-hospital-capacity-dev \\
            rapid-cortex-hospital-profiles-dev \\
            ...

    # 2. Delete the orphan/source stack via CloudFormation
    aws cloudformation delete-stack --stack-name <orphan-stack> --region us-east-1
    aws cloudformation wait stack-delete-complete --stack-name <orphan-stack> --region us-east-1

    # 3. Recreate the tables and restore items in the live account.
    python3 scripts/recreate-shared-tables.py restore \\
        --region us-east-1 \\
        --backup-dir /tmp/rc-stack-backup

By default `restore` recreates **schema only** — pass `--restore-data` (or
`--restore-data <table>...`) to also write Items back from the backup scan.

Notes
-----
- Source-of-truth ownership belongs in CloudFormation. Use this script only as
  a temporary bridge; the recreated tables are unmanaged until you import them
  into a stack (e.g. `infra/nested/stack-data-layer.yaml`).
- Re-running `restore` is idempotent: existing tables are skipped.
- Backups live as plain JSON (one file per table for `describe-table` output
  and one per table for the `scan` dump) so they're easy to inspect / diff.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable


def aws(args: list[str], region: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    cmd = ["aws", *args, "--region", region]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"aws {' '.join(args)} failed: {r.stderr.strip()}")
    return r


def table_exists(name: str, region: str) -> bool:
    return aws(["dynamodb", "describe-table", "--table-name", name], region, check=False).returncode == 0


def schema_path(backup_dir: Path, name: str) -> Path:
    return backup_dir / "schemas" / f"{name}.json"


def data_path(backup_dir: Path, name: str) -> Path:
    return backup_dir / f"{name}.json"


def cmd_backup(args: argparse.Namespace) -> int:
    backup_dir: Path = args.backup_dir
    (backup_dir / "schemas").mkdir(parents=True, exist_ok=True)
    for name in args.tables:
        desc = aws(["dynamodb", "describe-table", "--table-name", name, "--output", "json"], args.region)
        schema_path(backup_dir, name).write_text(desc.stdout)
        scan = aws(["dynamodb", "scan", "--table-name", name, "--output", "json"], args.region)
        data_path(backup_dir, name).write_text(scan.stdout)
        items = len(json.loads(scan.stdout).get("Items", []))
        print(f"backed up {name} (items={items})")
    print("Backup complete →", backup_dir)
    return 0


def create_from_schema(name: str, backup_dir: Path, region: str) -> None:
    desc = json.loads(schema_path(backup_dir, name).read_text())["Table"]
    billing_mode = desc.get("BillingModeSummary", {}).get("BillingMode", "PAY_PER_REQUEST")
    payload: dict = {
        "TableName": name,
        "AttributeDefinitions": desc["AttributeDefinitions"],
        "KeySchema": desc["KeySchema"],
        "BillingMode": billing_mode,
    }
    if "GlobalSecondaryIndexes" in desc:
        payload["GlobalSecondaryIndexes"] = [
            {"IndexName": g["IndexName"], "KeySchema": g["KeySchema"], "Projection": g["Projection"]}
            for g in desc["GlobalSecondaryIndexes"]
        ]
    if billing_mode == "PROVISIONED":
        payload["ProvisionedThroughput"] = desc["ProvisionedThroughput"]
    aws(["dynamodb", "create-table", "--cli-input-json", json.dumps(payload)], region)
    print(f"  creating {name}…")
    for _ in range(60):
        r = aws(["dynamodb", "describe-table", "--table-name", name], region, check=False)
        if r.returncode == 0 and json.loads(r.stdout)["Table"]["TableStatus"] == "ACTIVE":
            print(f"  {name} ACTIVE")
            return
        time.sleep(3)
    raise TimeoutError(f"{name} not ACTIVE in time")


def restore_items(name: str, backup_dir: Path, region: str) -> None:
    path = data_path(backup_dir, name)
    if not path.exists():
        return
    items = json.loads(path.read_text()).get("Items", [])
    if not items:
        return
    for item in items:
        aws(["dynamodb", "put-item", "--table-name", name, "--item", json.dumps(item)], region)
    print(f"  restored {len(items)} items → {name}")


def cmd_restore(args: argparse.Namespace) -> int:
    backup_dir: Path = args.backup_dir
    schema_files = sorted((backup_dir / "schemas").glob("*.json"))
    if not schema_files:
        print(f"No schemas found in {backup_dir / 'schemas'}", file=sys.stderr)
        return 1
    tables = [p.stem for p in schema_files]
    for name in tables:
        if table_exists(name, args.region):
            print(f"skip exists: {name}")
            continue
        create_from_schema(name, backup_dir, args.region)
    if args.restore_data is not None:
        targets: Iterable[str] = args.restore_data or tables
        for name in targets:
            if table_exists(name, args.region):
                restore_items(name, backup_dir, args.region)
    print("Done.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--region", default="us-east-1")
    p.add_argument("--backup-dir", type=Path, default=Path("/tmp/rc-stack-backup"))
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("backup", help="Snapshot describe-table + scan for each table.")
    b.add_argument("--tables", nargs="+", required=True, help="Table names to back up.")
    b.set_defaults(func=cmd_backup)

    r = sub.add_parser("restore", help="Recreate tables from backup; optionally restore items.")
    r.add_argument(
        "--restore-data",
        nargs="*",
        default=None,
        help="Pass with no args to restore items for ALL backed-up tables, or list specific tables.",
    )
    r.set_defaults(func=cmd_restore)

    return p


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
