#!/usr/bin/env python3
"""Fill missing HBCU outreach fields from researched official sources."""
from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.comments import Comment

ROOT = Path(__file__).resolve().parent
SRC = Path("/Users/jeffcoleman/Downloads/NexCort_iQ_HBCU_Campus_Outreach.xlsx")
OUT = Path("/Users/jeffcoleman/Downloads/NexCort_iQ_HBCU_Campus_Outreach_FILLED.xlsx")
DATA = ROOT / "hbcu_all.json"

DEPT_EMAIL_RE = re.compile(
    r"(police|safety|security|upd|dps|dispatch|public\.?safety|campus.?safety|"
    r"campussafety|gsopolice|msupolice|fampol|hudps|fmucampussafety|"
    r"wupublicsafety|xupd)",
    re.I,
)


def blank(v) -> bool:
    return v is None or (isinstance(v, str) and not str(v).strip())


def norm_phone(p) -> str | None:
    if not p:
        return None
    s = str(p).strip()
    # Preserve trailing extension notes when present
    ext = ""
    m = re.search(r"(ext\.?\s*\d+|x\d+)$", s, re.I)
    if m:
        ext = " " + m.group(1).replace("x", "ext. ")
        s = s[: m.start()].strip()
    digits = re.sub(r"\D", "", s)
    if len(digits) == 11 and digits[0] == "1":
        digits = digits[1:]
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}{ext}".strip()
    return str(p).strip()


def zip5(z) -> str | None:
    if not z:
        return None
    return str(z).split("-")[0][:5]


def safe_email(email) -> str | None:
    if blank(email):
        return None
    e = str(email).strip()
    local = e.split("@")[0]
    if DEPT_EMAIL_RE.search(local) or DEPT_EMAIL_RE.search(e):
        return e
    # Reject personal-looking mailboxes
    return None


def enroll_year(raw) -> int | None:
    if blank(raw):
        return None
    m = re.search(r"(20\d{2})", str(raw))
    return int(m.group(1)) if m else None


def main() -> None:
    by_id = {int(k): v for k, v in json.loads(DATA.read_text()).items()}
    wb = load_workbook(SRC)
    ws = wb["HBCU Outreach"]
    h = {ws.cell(1, c).value: c for c in range(1, ws.max_column + 1)}
    stats = {
        "enroll": 0,
        "addr": 0,
        "phone": 0,
        "email": 0,
        "rows": 0,
        "skipped_personal_email": 0,
    }

    for r in range(2, ws.max_row + 1):
        rid = ws.cell(r, h["#"]).value
        data = by_id.get(int(rid)) if rid is not None else None
        if not data:
            continue
        changed = False

        def set_blank(col: str, val, counter: str | None = None) -> None:
            nonlocal changed
            if blank(val):
                return
            cell = ws.cell(r, h[col])
            if blank(cell.value):
                cell.value = val
                changed = True
                if counter:
                    stats[counter] += 1

        set_blank("Student enrollment", data.get("enrollment"), "enroll")
        set_blank("Enrollment year", enroll_year(data.get("enrollment_year")), "enroll")
        set_blank("Main campus street address", data.get("street"), "addr")
        set_blank("ZIP", zip5(data.get("zip")), "addr")
        set_blank("Phone number", norm_phone(data.get("phone")), "phone")

        email = safe_email(data.get("email"))
        if data.get("email") and not email:
            stats["skipped_personal_email"] += 1
        set_blank("Email", email, "email")

        # Never invent Named contact — leave blank
        # Enrich Recommended POC when still generic and we have a department email/phone
        poc = ws.cell(r, h["Recommended point of contact"])
        if (
            not blank(ws.cell(r, h["Phone number"]).value)
            and poc.value
            and "Director of Campus Safety / Chief of Police" in str(poc.value)
        ):
            # Align with verified NC A&T / TSU style when we filled a path
            poc.value = "University Police / Public Safety"
            changed = True

        enc = ws.cell(r, h["Student enrollment"])
        if data.get("enrollment_source") and not blank(enc.value):
            enc.comment = Comment(
                f"Enrollment source: {data['enrollment_source']}",
                "NexCort research",
            )
        phone_cell = ws.cell(r, h["Phone number"])
        if data.get("source_url") and not blank(phone_cell.value):
            phone_cell.comment = Comment(
                f"Contact source: {data['source_url']}",
                "NexCort research",
            )

        if changed:
            stats["rows"] += 1

    rm = wb["Read Me"]
    for r in range(1, rm.max_row + 1):
        key = rm.cell(r, 1).value
        if key == "Address status":
            rm.cell(r, 2).value = (
                "Main campus or public-safety street addresses populated from official .edu "
                "pages (filled 2026-10-11)."
            )
        if key == "Phone status":
            rm.cell(r, 2).value = (
                "Campus police/public safety non-emergency lines preferred; do not use for "
                "emergency dispatch solicitation. Ask for administrative transfer."
            )
        if key == "Enrollment / crime":
            rm.cell(r, 2).value = (
                "Fall enrollment filled from IPEDS/CDS/institutional IR where available "
                "(see cell comments). Clery crime join still pending. Blanks are NOT zero. "
                "Knoxville College operating but not Title IV/IPEDS — enrollment left blank."
            )
        if key == "Prepared":
            rm.cell(r, 2).value = (
                "October 2026 (contacts/enrollment filled); verify institutions still "
                "operating and official HBCU designations before outreach. Named contacts "
                "intentionally left blank."
            )
    rm.cell(rm.max_row + 1, 1).value = "Fill method"
    rm.cell(rm.max_row, 2).value = (
        "Official .edu campus police/public safety pages + IPEDS/CDS/IR for enrollment; "
        "department emails only (personal chief emails omitted); phones ###-###-####."
    )

    wb.save(OUT)
    wb.save(SRC)

    wb3 = load_workbook(SRC)
    ws3 = wb3["HBCU Outreach"]
    headers = [ws3.cell(1, c).value for c in range(1, ws3.max_column + 1)]
    blanks = {name: 0 for name in headers}
    for r in range(2, ws3.max_row + 1):
        for c, name in enumerate(headers, 1):
            if blank(ws3.cell(r, c).value):
                blanks[name] += 1
    print("STATS", stats)
    print("REMAINING_BLANKS", blanks)
    print("OUT", OUT)
    # samples
    for rid in (1, 22, 57, 77, 88, 97):
        for r in range(2, ws3.max_row + 1):
            if ws3.cell(r, 1).value == rid:
                print(
                    rid,
                    [ws3.cell(r, c).value for c in range(1, 14)],
                )
                break


if __name__ == "__main__":
    main()
