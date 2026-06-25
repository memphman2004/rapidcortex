#!/usr/bin/env python3
"""Split AppManagedPolicyDynamoLambdaCrudShardC into ShardC + ShardD in a SAM YAML file.

Moves resources from VideoAssistSessionsTable onward into a new ShardD block and
attaches !Ref AppManagedPolicyDynamoLambdaCrudShardD after every ShardC ref.
Idempotent: skips files that already define ShardD.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MARKER_START = "                - !Sub arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${VideoAssistSessionsTable}"
MARKER_END_RESOURCE = "                  - !Ref AWS::NoValue\n\n  AppManagedPolicyS3ApplicationBucketsCrud:"


def shard_d_block(*, managed_name_line: str, sid: str) -> str:
    return f"""  AppManagedPolicyDynamoLambdaCrudShardD:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      {managed_name_line}
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: {sid}
            Effect: Allow
            Action:
              - dynamodb:GetItem
              - dynamodb:BatchGetItem
              - dynamodb:BatchWriteItem
              - dynamodb:PutItem
              - dynamodb:DeleteItem
              - dynamodb:UpdateItem
              - dynamodb:Query
              - dynamodb:Scan
              - dynamodb:DescribeTable
              - dynamodb:ConditionCheckItem
            Resource:
"""


def split_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "AppManagedPolicyDynamoLambdaCrudShardD:" in text:
        print(f"skip (ShardD exists): {path}")
        return False

    m = re.search(
        r"(  AppManagedPolicyDynamoLambdaCrudShardC:\n.*?            Resource:\n)(.*?)(\n  AppManagedPolicyS3ApplicationBucketsCrud:)",
        text,
        re.S,
    )
    if not m:
        print(f"skip (ShardC block not found): {path}")
        return False

    resources = m.group(2)
    if MARKER_START not in resources:
        print(f"skip (VideoAssist split marker missing): {path}")
        return False

    head, tail = resources.split(MARKER_START, 1)
    tail_lines = MARKER_START + tail

    name_m = re.search(
        r"ManagedPolicyName: !Sub \"(\$\{[^}]+\}-lambda-ddb-crud-\$\{DeploymentStage\}-c|\$\{Sam4ManagedPolicyNamePrefix\}-sam4-lambda-ddb-crud-\$\{DeploymentStage\}-c)\"",
        m.group(0),
    )
    if not name_m:
        print(f"skip (managed policy name not found): {path}")
        return False

    name_c = name_m.group(1)
    if "sam4" in name_c or "Sam4" in name_c:
        name_d = name_c.replace("-c", "-d")
        sid_d = "DynamoApplicationShardD"
    elif "sam5" in path.name:
        name_d = "${AppName}-sam5-lambda-ddb-crud-${DeploymentStage}-d"
        sid_d = "DynamoApplicationShardD"
    else:
        name_d = name_c.replace("-c", "-d")
        sid_d = "DynamoApplicationShardD"

    shard_d = shard_d_block(
        managed_name_line=f'ManagedPolicyName: !Sub "{name_d}"',
        sid=sid_d,
    )
    new_shard_c_resources = head.rstrip() + "\n"
    new_shard_d_resources = tail_lines.rstrip() + "\n"

    new_text = (
        text[: m.start()]
        + m.group(1)
        + new_shard_c_resources
        + "\n"
        + shard_d
        + new_shard_d_resources
        + m.group(3)
        + text[m.end() :]
    )

    lines = new_text.splitlines(keepends=True)
    out: list[str] = []
    added = 0
    i = 0
    while i < len(lines):
        out.append(lines[i])
        if "AppManagedPolicyDynamoLambdaCrudShardC" in lines[i] and "!Ref" in lines[i]:
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if "AppManagedPolicyDynamoLambdaCrudShardD" not in nxt:
                indent = lines[i].split("-")[0]
                out.append(f"{indent}- !Ref AppManagedPolicyDynamoLambdaCrudShardD\n")
                added += 1
        i += 1

    path.write_text("".join(out), encoding="utf-8")
    print(f"split {path}: attached ShardD on {added} policies")
    return True


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    targets = [
        root / "infra/nested/stack-app-sam.yaml",
        root / "infra/nested/stack-app-sam-4.yaml",
    ]
    if len(sys.argv) > 1:
        targets = [Path(p) for p in sys.argv[1:]]
    changed = sum(1 for p in targets if split_file(p))
    return 0 if changed or not targets else 1


if __name__ == "__main__":
    sys.exit(main())
