#!/usr/bin/env python3
"""Fail when a deployable template or the current shell turns a mock on.

Engineering examples (scripts/env-api-*.example.sh) may document opt-in mocks.
Nested stacks that ship, and the environment deploy.sh already sourced, may not.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NESTED = ROOT / "infra" / "nested"
MOCK_LINE = re.compile(
    r"""^[\s"]*([A-Z0-9_]*MOCK[A-Z0-9_]*)["']?\s*:\s*["']?(true|1)["']?\s*$""",
    re.IGNORECASE,
)
ENV_TRUE = {"1", "true", "TRUE", "True", "yes", "YES"}


def template_hits() -> list[str]:
    hits: list[str] = []
    for path in sorted(NESTED.glob("stack-app-sam*.yaml")):
        if ".before" in path.name:
            continue
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            match = MOCK_LINE.match(line)
            if match:
                hits.append(f"{path.relative_to(ROOT)}:{number}: {match.group(1)}")
    return hits


def env_hits() -> list[str]:
    hits: list[str] = []
    for key, value in sorted(os.environ.items()):
        if "MOCK" not in key:
            continue
        if value.strip() in ENV_TRUE:
            hits.append(f"{key}={value}")
    return hits


def main() -> int:
    problems = template_hits()
    if os.environ.get("CHECK_DEPLOY_ENV") == "1":
        problems.extend(env_hits())
    if problems:
        print("P0 mock gate failed. These are on in a shippable template or this deploy shell:", file=sys.stderr)
        for item in problems:
            print(f"  {item}", file=sys.stderr)
        print("Set them to false, or keep the mock only in a local example env that deploy.sh does not source.", file=sys.stderr)
        return 1
    print("P0 mock gate passed (shippable templates, and this shell when CHECK_DEPLOY_ENV=1).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
