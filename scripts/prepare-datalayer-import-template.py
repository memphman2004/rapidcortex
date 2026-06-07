#!/usr/bin/env python3
"""Build a CloudFormation import template: deployed nested stack + new Resources only (raw YAML merge)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def extract_resource_block(text: str, logical_id: str) -> str | None:
    """Return the full `  LogicalId:` block from a Resources section."""
    pattern = re.compile(
        rf"(^  {re.escape(logical_id)}:\n(?:    .+\n)+)",
        re.MULTILINE,
    )
    match = pattern.search(text)
    if not match:
        return None
    block = match.group(1)
    # Imported resources must not reference Conditions absent from the deployed template.
    block = re.sub(r"^    Condition: .+\n", "", block, flags=re.MULTILINE)
    return block


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "usage: prepare-datalayer-import-template.py "
            "<deployed-template.yaml> <repo-template.yaml> <resources-json> <out.yaml>",
            file=sys.stderr,
        )
        return 2

    deployed_path, repo_path, resources_json, out_path = map(Path, sys.argv[1:5])
    import_ids = [
        item["LogicalResourceId"]
        for item in json.loads(resources_json.read_text(encoding="utf-8"))
    ]

    deployed_text = deployed_path.read_text(encoding="utf-8")
    repo_text = repo_path.read_text(encoding="utf-8")

    if "Resources:" not in deployed_text:
        print("ERROR: deployed template missing Resources section", file=sys.stderr)
        return 1
    if "Outputs:" not in deployed_text:
        print("ERROR: deployed template missing Outputs section", file=sys.stderr)
        return 1

    blocks: list[str] = []
    for logical_id in import_ids:
        if re.search(rf"^  {re.escape(logical_id)}:\n", deployed_text, re.MULTILINE):
            print(f"(warn) {logical_id} already in deployed template — skipping merge", file=sys.stderr)
            continue
        block = extract_resource_block(repo_text, logical_id)
        if not block:
            print(f"ERROR: {logical_id} missing from repo template Resources", file=sys.stderr)
            return 1
        blocks.append(block.rstrip("\n"))

    if not blocks:
        print("ERROR: no Resources merged for import", file=sys.stderr)
        return 1

    insert = "\n".join(blocks) + "\n"
    merged = re.sub(r"^Outputs:", insert + "Outputs:", deployed_text, count=1, flags=re.MULTILINE)
    if merged == deployed_text:
        print("ERROR: failed to insert Resources before Outputs", file=sys.stderr)
        return 1

    out_path.write_text(merged, encoding="utf-8")
    print(
        f"(import) merged {len(blocks)} Resource(s) into deployed template: {', '.join(import_ids)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
