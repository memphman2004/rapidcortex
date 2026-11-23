#!/usr/bin/env python3
"""
protect-apigw-resources.py
==========================
Adds DeletionPolicy: Retain and UpdateReplacePolicy: Retain to every
AWS::ApiGatewayV2::Route and AWS::ApiGatewayV2::Integration resource in
all nested SAM/CloudFormation templates.

WHY: API Gateway routes and integrations have no DeletionPolicy by default.
When a CloudFormation stack UPDATE fails and rolls back, CF deletes any
routes/integrations it created during the failed update. This causes "routing
drift" — the stack ends up with DELETED routes in AWS but CF still tracks the
phantom physical IDs, breaking every endpoint in that feature stack.

Adding DeletionPolicy: Retain tells CF to skip the DELETE API call when
removing a resource from the template or during rollback, so the physical
route/integration survives and traffic continues to flow.

Usage:
    python3 scripts/protect-apigw-resources.py [--check] [path/to/template.yaml ...]

    --check   Dry-run mode: report unprotected resources without modifying files.
              Exits 1 if any unprotected resources are found (CI gate mode).

If no paths are given, scans infra/nested/*.yaml relative to CWD.
"""

import argparse
import re
import sys
from pathlib import Path

PROTECTED_TYPES = {
    "AWS::ApiGatewayV2::Route",
    "AWS::ApiGatewayV2::Integration",
}

# Lines we want to inject, in order:
# DeletionPolicy: Retain
# UpdateReplacePolicy: Retain
DELETION_POLICY_LINE = "DeletionPolicy: Retain"
UPDATE_REPLACE_POLICY_LINE = "UpdateReplacePolicy: Retain"


def protect_template(path: Path, check_only: bool) -> tuple[int, int]:
    """
    Process one YAML file. Returns (unprotected_count, fixed_count).
    unprotected_count: how many resources lacked protection before this run.
    fixed_count: how many were fixed (0 in check_only mode).
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    # Locate every resource block by scanning for logical ID + Type
    # We build a list of (line_index, type_string, has_deletion, has_update_replace)
    # so we can patch in one pass.

    # First, find line indices for all Type: entries that match protected types.
    type_lines: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        for t in PROTECTED_TYPES:
            if stripped == f"Type: {t}":
                type_lines.append((i, t))
                break

    if not type_lines:
        return 0, 0

    unprotected: list[int] = []  # indices into type_lines

    for idx, (line_i, type_str) in enumerate(type_lines):
        # Scan the resource block (from line_i onwards) for DeletionPolicy and
        # UpdateReplacePolicy. The resource block ends at the next top-level key
        # (same or less indentation as the Type line, but NOT the Type line itself).
        type_indent = len(lines[line_i]) - len(lines[line_i].lstrip())

        # Find the indentation of the logical ID (one level up from Type)
        # Logical ID is at type_indent - 2 spaces typically.
        # We also look backward from Type for the logical ID line.
        logical_id_indent = type_indent - 2

        has_deletion = False
        has_update_replace = False

        # Scan forward from type_line within the resource block
        j = line_i + 1
        while j < len(lines):
            l = lines[j]
            stripped_l = l.strip()
            if not stripped_l or stripped_l.startswith("#"):
                j += 1
                continue
            current_indent = len(l) - len(l.lstrip())
            # Stop when we hit a sibling resource (same indent as logical ID)
            # or a parent-level key
            if current_indent <= logical_id_indent and stripped_l and not stripped_l.startswith("#"):
                break
            if stripped_l == DELETION_POLICY_LINE:
                has_deletion = True
            if stripped_l == UPDATE_REPLACE_POLICY_LINE:
                has_update_replace = True
            j += 1

        # Also scan backward from type_line (DeletionPolicy can appear before Type)
        j = line_i - 1
        while j >= 0:
            l = lines[j]
            stripped_l = l.strip()
            if not stripped_l or stripped_l.startswith("#"):
                j -= 1
                continue
            current_indent = len(l) - len(l.lstrip())
            if current_indent <= logical_id_indent:
                break
            if stripped_l == DELETION_POLICY_LINE:
                has_deletion = True
            if stripped_l == UPDATE_REPLACE_POLICY_LINE:
                has_update_replace = True
            j -= 1

        if not has_deletion or not has_update_replace:
            unprotected.append(idx)

    if not unprotected:
        return 0, 0

    if check_only:
        return len(unprotected), 0

    # Patch mode: insert missing lines after the Type: line.
    # Work backwards through the list so indices remain valid.
    new_lines = list(lines)
    for idx in reversed(unprotected):
        line_i, type_str = type_lines[idx]
        type_indent = len(new_lines[line_i]) - len(new_lines[line_i].lstrip())
        indent = " " * type_indent

        # Re-scan to know what's already there (after potential earlier insertions
        # in the same file have shifted line numbers — but we're going backwards
        # so earlier (higher line_i) patches don't affect this one).
        # Scan forward for existing lines.
        has_deletion = False
        has_update_replace = False
        logical_id_indent = type_indent - 2
        j = line_i + 1
        while j < len(new_lines):
            l = new_lines[j]
            stripped_l = l.strip()
            if not stripped_l or stripped_l.startswith("#"):
                j += 1
                continue
            current_indent = len(l) - len(l.lstrip())
            if current_indent <= logical_id_indent:
                break
            if stripped_l == DELETION_POLICY_LINE:
                has_deletion = True
            if stripped_l == UPDATE_REPLACE_POLICY_LINE:
                has_update_replace = True
            j += 1

        # Also backward
        j = line_i - 1
        while j >= 0:
            l = new_lines[j]
            stripped_l = l.strip()
            if not stripped_l or stripped_l.startswith("#"):
                j -= 1
                continue
            current_indent = len(l) - len(l.lstrip())
            if current_indent <= logical_id_indent:
                break
            if stripped_l == DELETION_POLICY_LINE:
                has_deletion = True
            if stripped_l == UPDATE_REPLACE_POLICY_LINE:
                has_update_replace = True
            j -= 1

        # Build lines to insert after the Type line
        to_insert = []
        if not has_deletion:
            to_insert.append(f"{indent}{DELETION_POLICY_LINE}\n")
        if not has_update_replace:
            # Insert UpdateReplacePolicy right after DeletionPolicy (or after Type)
            to_insert.append(f"{indent}{UPDATE_REPLACE_POLICY_LINE}\n")

        if to_insert:
            insert_pos = line_i + 1
            for ins_line in reversed(to_insert):
                new_lines.insert(insert_pos, ins_line)

    path.write_text("".join(new_lines), encoding="utf-8")
    return len(unprotected), len(unprotected)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="Dry-run / CI gate: exit 1 if unprotected resources exist")
    parser.add_argument("paths", nargs="*", help="Template files to process (default: infra/nested/*.yaml)")
    args = parser.parse_args()

    if args.paths:
        paths = [Path(p) for p in args.paths]
    else:
        base = Path(__file__).parent.parent / "infra" / "nested"
        paths = sorted(base.glob("*.yaml"))

    total_unprotected = 0
    total_fixed = 0
    total_files_changed = 0

    for path in paths:
        if not path.exists():
            print(f"  SKIP (not found): {path}")
            continue
        unprotected, fixed = protect_template(path, check_only=args.check)
        if unprotected:
            total_unprotected += unprotected
            total_fixed += fixed
            if args.check:
                print(f"  UNPROTECTED {unprotected:3d}  {path.name}")
            else:
                total_files_changed += 1
                print(f"  FIXED  {fixed:3d}  {path.name}")

    if args.check:
        if total_unprotected:
            print(f"\n✗ {total_unprotected} Route/Integration resource(s) lack DeletionPolicy+UpdateReplacePolicy: Retain")
            print("  Run:  python3 scripts/protect-apigw-resources.py")
            return 1
        else:
            print("✓ All Route/Integration resources have DeletionPolicy+UpdateReplacePolicy: Retain")
            return 0
    else:
        if total_fixed:
            print(f"\n✓ Protected {total_fixed} resource(s) across {total_files_changed} file(s)")
        else:
            print("✓ All Route/Integration resources already protected — no changes needed")
        return 0


if __name__ == "__main__":
    sys.exit(main())
