#!/usr/bin/env python3
"""Fail when an IAM Resource/Action list can serialize to empty.

CloudFormation drops !Ref AWS::NoValue from a sequence. If every item in
Resource: or Action: is an !If whose false branch is AWS::NoValue, IAM receives
Resource: [] and rejects the role: "Policy statement must contain resources."
sam validate --lint does not catch this.

Mixed lists (unconditional ARNs plus optional !If items) are allowed — dropping
the optional items still leaves a Resource. Hoist !If to the Statement when the
whole statement is optional.

  UNSAFE
    Resource:
      - !If [HasSecret, !Ref SecretArn, !Ref AWS::NoValue]

  SAFE (unconditional sibling remains)
    Resource:
      - !Sub arn:aws:dynamodb:...:table/${AuditTable}
      - !If [HasVenueConfigTable, !Sub .../${VenueConfigTable}, !Ref AWS::NoValue]

  SAFE (entire statement dropped)
    - !If
      - HasSecret
      - Statement:
          Effect: Allow
          Action: secretsmanager:GetSecretValue
          Resource: !Ref SecretArn
      - !Ref AWS::NoValue

Usage:
  python3 scripts/check-iam-novalue-resources.py
  python3 scripts/check-iam-novalue-resources.py infra/nested/stack-app-sam-5.yaml
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IAM_KEYS = {"Resource", "Action"}
SKIP_NAME_RE = re.compile(r"\.before[-.]")
KEY_RE = re.compile(r"""^["']?([A-Za-z0-9_]+)["']?\s*:(.*)$""")
DEFAULT_PATHS = [
    ROOT / "infra" / "template.yaml",
    *(
        p
        for p in sorted((ROOT / "infra" / "nested").glob("stack-*.yaml"))
        if not SKIP_NAME_RE.search(p.name)
    ),
]


def _is_novalue_node(obj: object) -> bool:
    if isinstance(obj, dict) and obj.get("Ref") == "AWS::NoValue":
        return True
    return False


def _if_false_is_novalue(obj: object) -> bool:
    if isinstance(obj, dict) and "Fn::If" in obj:
        branch = obj["Fn::If"]
        return isinstance(branch, list) and len(branch) == 3 and _is_novalue_node(branch[2])
    return False


def _list_can_empty(items: list[object]) -> bool:
    if not items:
        return False
    return all(_if_false_is_novalue(item) or _is_novalue_node(item) for item in items)


def check_json(obj: object, path: list[str], hits: list[str], prefix: str) -> None:
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key in IAM_KEYS:
                if _if_false_is_novalue(val) or _is_novalue_node(val):
                    loc = "/".join(path + [key])
                    hits.append(
                        f"{prefix}: IAM {loc} uses AWS::NoValue as the entire {key} "
                        "(property omitted on a remaining Statement)"
                    )
                elif isinstance(val, list) and _list_can_empty(val):
                    loc = "/".join(path + [key])
                    hits.append(
                        f"{prefix}: IAM {loc} list is only optional AWS::NoValue items "
                        f"(empty {key} at deploy; hoist !If to the Statement)"
                    )
            check_json(val, path + [str(key)], hits, prefix)
        return
    if isinstance(obj, list):
        for idx, val in enumerate(obj):
            check_json(val, path + [str(idx)], hits, prefix)


def _item_is_optional_novalue(text: str) -> bool:
    if "AWS::NoValue" not in text:
        return False
    return bool(re.search(r"(?:!If|Fn::If)", text)) or text.strip() in {
        "- !Ref AWS::NoValue",
        "- Ref: AWS::NoValue",
        "- {Ref: AWS::NoValue}",
    }


def _split_yaml_list_items(block_lines: list[str]) -> list[str]:
    dash_indents = []
    for line in block_lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if line.lstrip().startswith("- "):
            dash_indents.append(indent)
    if not dash_indents:
        return []
    item_indent = min(dash_indents)
    items: list[list[str]] = []
    current: list[str] = []
    for line in block_lines:
        if not line.strip() or line.lstrip().startswith("#"):
            if current:
                current.append(line)
            continue
        indent = len(line) - len(line.lstrip())
        if indent == item_indent and line.lstrip().startswith("- "):
            if current:
                items.append(current)
            current = [line]
        elif current:
            current.append(line)
    if current:
        items.append(current)
    return ["\n".join(item) for item in items]


def check_yaml_indent(text: str, prefix: str) -> list[str]:
    hits: list[str] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.split("#", 1)[0].rstrip()
        if not stripped.strip():
            i += 1
            continue
        match = KEY_RE.match(stripped.strip())
        if not match or match.group(1) not in IAM_KEYS:
            i += 1
            continue
        key = match.group(1)
        rest = match.group(2).strip()
        key_indent = len(raw) - len(raw.lstrip())
        lineno = i + 1
        if rest and "AWS::NoValue" in rest:
            hits.append(
                f"{prefix}:{lineno}: IAM {key} uses AWS::NoValue as the entire value "
                "(property omitted on a remaining Statement)"
            )
            i += 1
            continue
        block: list[str] = []
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            nxt_stripped = nxt.split("#", 1)[0].rstrip()
            if not nxt_stripped.strip():
                j += 1
                continue
            nxt_indent = len(nxt) - len(nxt.lstrip())
            if nxt_indent <= key_indent:
                break
            block.append(nxt)
            j += 1
        items = _split_yaml_list_items(block)
        if items and all(_item_is_optional_novalue(item) for item in items):
            hits.append(
                f"{prefix}:{lineno}: IAM {key} list is only optional AWS::NoValue items "
                f"(empty {key} at deploy; hoist !If to the Statement)"
            )
        i = j
    return hits


def check_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT) if path.is_relative_to(ROOT) else path
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            hits: list[str] = []
            check_json(json.loads(text), [], hits, str(rel))
            return hits
        except json.JSONDecodeError:
            pass
    return check_yaml_indent(text, str(rel))


def main(argv: list[str]) -> int:
    paths = [Path(a) for a in argv] if argv else DEFAULT_PATHS
    findings: list[str] = []
    scanned = 0
    for path in paths:
        if not path.is_file():
            print(f"skip missing {path}", file=sys.stderr)
            continue
        scanned += 1
        findings.extend(check_file(path))
    if findings:
        print("IAM AWS::NoValue can empty Resource/Action (statement-level !If required):", file=sys.stderr)
        for line in findings:
            print(f"  {line}", file=sys.stderr)
        print(
            "Hoist !If to the Statement array so CloudFormation drops the whole "
            "statement. Do not make every Resource/Action list item optional NoValue.",
            file=sys.stderr,
        )
        return 1
    print(f"IAM NoValue Resource/Action check ok ({scanned} templates)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
