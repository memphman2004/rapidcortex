#!/usr/bin/env python3
"""Estimate AWS IAM managed policy document sizes in SAM nested stacks.

AWS enforces a 6,144-byte limit on customer managed policy documents (minified JSON
after CloudFormation resolution). This script parses AppManagedPolicy* resources,
resolves table ARNs to worst-case physical names, and fails if any policy exceeds
the limit minus headroom.

Usage:
  python3 scripts/check-iam-managed-policy-sizes.py [--headroom 512] [path ...]

Default paths: all infra/nested/stack-app-sam*.yaml templates.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

IAM_POLICY_MAX_BYTES = 6144
DEFAULT_HEADROOM = 512
DEFAULT_STAGE = "dev"
DEFAULT_REGION = "us-east-1"
DEFAULT_ACCOUNT = "123456789012"

DYNAMO_ACTIONS = [
    "dynamodb:GetItem",
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:PutItem",
    "dynamodb:DeleteItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:Scan",
    "dynamodb:DescribeTable",
    "dynamodb:ConditionCheckItem",
]

# CamelCase Table param → kebab physical name (worst-case length proxy)
def physical_table_name(param: str, stage: str) -> str:
    if param.startswith("rapid-cortex-"):
        return param.replace("${DeploymentStage}", stage)
    core = re.sub(r"Table$", "", param)
    kebab = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", core).lower()
    return f"rapid-cortex-{kebab}-{stage}"


def table_arn(param_or_literal: str, region: str, account: str, stage: str) -> str:
    name = physical_table_name(param_or_literal, stage)
    return f"arn:aws:dynamodb:{region}:{account}:table/{name}"


def extract_managed_policies(yaml_text: str) -> list[tuple[str, str]]:
    """Return (logical_id, policy_block_yaml) for each AppManagedPolicy* resource."""
    policies: list[tuple[str, str]] = []
    for m in re.finditer(
        r"^  (AppManagedPolicy[A-Za-z0-9]+):\n    Type: AWS::IAM::ManagedPolicy\n(.*?)(?=^  [A-Z][A-Za-z0-9]+:|^Outputs:|\Z)",
        yaml_text,
        re.M | re.S,
    ):
        policies.append((m.group(1), m.group(2)))
    return policies


def dynamo_resources_from_policy_block(block: str, region: str, account: str, stage: str) -> list[str]:
    """Collect DynamoDB table/index ARNs; treat every !If branch as present (worst case)."""
    resources: list[str] = []
    seen: set[str] = set()

    def add_table(name: str) -> None:
        base = table_arn(name, region, account, stage)
        for arn in (base, f"{base}/index/*"):
            if arn not in seen:
                seen.add(arn)
                resources.append(arn)

    for param in re.findall(r"table/\$\{(\w+)\}", block):
        add_table(param)
    for literal in re.findall(r"table/(rapid-cortex-[^\s/${}]+)", block):
        add_table(literal)

    return resources


def policy_document_bytes(
    *,
    sid: str,
    actions: list[str],
    resources: list[str],
) -> int:
    doc = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": sid,
                "Effect": "Allow",
                "Action": actions,
                "Resource": resources,
            }
        ],
    }
    return len(json.dumps(doc, separators=(",", ":")).encode("utf-8"))


def check_file(path: Path, headroom: int, stage: str, region: str, account: str) -> list[str]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    limit = IAM_POLICY_MAX_BYTES - headroom

    for logical_id, block in extract_managed_policies(text):
        if "dynamodb:" not in block and "execute-api:" not in block and "s3:" not in block:
            continue

        if "dynamodb:" in block:
            resources = dynamo_resources_from_policy_block(block, region, account, stage)
            sid_m = re.search(r"Sid:\s*(\S+)", block)
            sid = sid_m.group(1) if sid_m else logical_id
            size = policy_document_bytes(sid=sid, actions=DYNAMO_ACTIONS, resources=resources)
            pct = size / IAM_POLICY_MAX_BYTES * 100
            status = "ok" if size <= limit else "OVER"
            print(
                f"  {logical_id}: {size} bytes ({pct:.1f}% of {IAM_POLICY_MAX_BYTES}), "
                f"{len(resources)} ARNs — {status} (limit with {headroom}B headroom: {limit})"
            )
            if size > limit:
                errors.append(
                    f"{path}:{logical_id}: {size} bytes exceeds {limit} "
                    f"({IAM_POLICY_MAX_BYTES} - {headroom} headroom); {len(resources)} ARNs"
                )
        else:
            # Non-Dynamo managed policies are tiny; still report if present
            print(f"  {logical_id}: (non-Dynamo — skipped size model)")

    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Check IAM managed policy sizes in SAM templates")
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="SAM YAML files (default: infra/nested/stack-app-sam*.yaml)",
    )
    parser.add_argument("--headroom", type=int, default=DEFAULT_HEADROOM)
    parser.add_argument("--stage", default=DEFAULT_STAGE)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--account", default=DEFAULT_ACCOUNT)
    args = parser.parse_args()

    paths = args.paths or sorted(
        p
        for p in (root / "infra" / "nested").glob("stack-app-sam*.yaml")
        if ".before-" not in p.name
    )
    paths = [p if p.is_absolute() else root / p for p in paths]

    all_errors: list[str] = []
    print(f"IAM managed policy size check (headroom={args.headroom}B, stage={args.stage})")
    for path in paths:
        if not path.is_file():
            print(f"skip missing: {path}")
            continue
        print(f"\n{path.relative_to(root)}:")
        all_errors.extend(check_file(path, args.headroom, args.stage, args.region, args.account))

    if all_errors:
        print("\nFAILED:")
        for e in all_errors:
            print(f"  {e}")
        return 1

    print("\nAll checked managed policies are within size limits.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
