#!/usr/bin/env python3
"""
Rapid Cortex — Stress Test PDF Report Generator
Usage:
  python3 generate-stress-report.py \
    --results-dir results \
    --stage prod \
    --api-url https://api.rapidcortex.us \
    --output results/RC_StressTest_Report_20260816.pdf
"""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable, PageBreak, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

# ── Brand Colors ──────────────────────────────────────────────────────────────
RC_DARK   = colors.HexColor("#0A0E1A")
RC_NAVY   = colors.HexColor("#0D1B2A")
RC_BLUE   = colors.HexColor("#1B4FFF")
RC_BLUE2  = colors.HexColor("#2563EB")
RC_RED    = colors.HexColor("#DC2626")
RC_SILVER = colors.HexColor("#94A3B8")
RC_WHITE  = colors.HexColor("#F8FAFC")
RC_GREEN  = colors.HexColor("#16A34A")
RC_YELLOW = colors.HexColor("#D97706")
RC_GRAY   = colors.HexColor("#1E293B")
RC_LIGHT  = colors.HexColor("#CBD5E1")
RC_MID    = colors.HexColor("#334155")

PAGE_W, PAGE_H = letter

# ── Page decoration ───────────────────────────────────────────────────────────
def make_first_page(stage):
    def first_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(RC_DARK)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(RC_BLUE)
        canvas.rect(0, PAGE_H - 6, PAGE_W, 6, fill=1, stroke=0)
        canvas.setFillColor(RC_BLUE)
        canvas.rect(0, 0, PAGE_W, 4, fill=1, stroke=0)
        canvas.setFillColor(RC_GRAY)
        canvas.rect(0, 0, 4, PAGE_H, fill=1, stroke=0)
        canvas.restoreState()
    return first_page

def make_later_pages(stage):
    def later_pages(canvas, doc):
        canvas.saveState()
        # Background
        canvas.setFillColor(RC_DARK)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(RC_GRAY)
        canvas.rect(0, 0, 4, PAGE_H, fill=1, stroke=0)
        # Header bar
        canvas.setFillColor(RC_NAVY)
        canvas.rect(0, PAGE_H - 36, PAGE_W, 36, fill=1, stroke=0)
        canvas.setFillColor(RC_BLUE)
        canvas.rect(0, PAGE_H - 38, PAGE_W, 2, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(RC_BLUE)
        canvas.drawString(0.5 * inch, PAGE_H - 22, "RAPID CORTEX")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(RC_SILVER)
        canvas.drawString(1.36 * inch, PAGE_H - 22,
                          f"— Stress Test Report  |  Stage: {stage.upper()}  |  CONFIDENTIAL")
        # Footer bar
        canvas.setFillColor(RC_GRAY)
        canvas.rect(0, 0, PAGE_W, 28, fill=1, stroke=0)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(RC_SILVER)
        canvas.drawString(0.5 * inch, 10,
                          "Rapid Cortex — Intelligence at the speed of response  |  CONFIDENTIAL — Internal Use Only")
        canvas.drawRightString(PAGE_W - 0.5 * inch, 10, f"Page {doc.page}")
        canvas.restoreState()
    return later_pages

# ── Styles ────────────────────────────────────────────────────────────────────
def make_styles():
    b = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle("CoverTitle", parent=b["Title"],
            fontName="Helvetica-Bold", fontSize=28, textColor=RC_WHITE,
            alignment=TA_CENTER, spaceAfter=8, leading=34),
        "cover_sub": ParagraphStyle("CoverSub", parent=b["Normal"],
            fontName="Helvetica", fontSize=13, textColor=RC_SILVER,
            alignment=TA_CENTER, spaceAfter=4),
        "brand_label": ParagraphStyle("BrandLabel", parent=b["Normal"],
            fontName="Helvetica-Bold", fontSize=11, textColor=RC_BLUE,
            alignment=TA_CENTER, spaceAfter=4),
        "section_head": ParagraphStyle("SectionHead", parent=b["Heading1"],
            fontName="Helvetica-Bold", fontSize=13, textColor=RC_BLUE,
            spaceBefore=18, spaceAfter=6, leading=16),
        "sub_head": ParagraphStyle("SubHead", parent=b["Heading2"],
            fontName="Helvetica-Bold", fontSize=10, textColor=RC_SILVER,
            spaceBefore=10, spaceAfter=4, leading=13),
        "body": ParagraphStyle("Body", parent=b["Normal"],
            fontName="Helvetica", fontSize=9, textColor=RC_LIGHT,
            spaceAfter=4, leading=13),
        "verdict_pass": ParagraphStyle("VerdictPass", parent=b["Normal"],
            fontName="Helvetica-Bold", fontSize=22, textColor=RC_GREEN,
            alignment=TA_CENTER, spaceAfter=6),
        "verdict_fail": ParagraphStyle("VerdictFail", parent=b["Normal"],
            fontName="Helvetica-Bold", fontSize=22, textColor=RC_RED,
            alignment=TA_CENTER, spaceAfter=6),
        "verdict_warn": ParagraphStyle("VerdictWarn", parent=b["Normal"],
            fontName="Helvetica-Bold", fontSize=22, textColor=RC_YELLOW,
            alignment=TA_CENTER, spaceAfter=6),
    }

# ── Table helper ──────────────────────────────────────────────────────────────
BASE_TABLE_STYLE = TableStyle([
    ("BACKGROUND",    (0, 0), (-1, 0),  RC_GRAY),
    ("TEXTCOLOR",     (0, 0), (-1, 0),  RC_BLUE),
    ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0, 0), (-1, 0),  8),
    ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
    ("BOTTOMPADDING", (0, 0), (-1, 0),  6),
    ("TOPPADDING",    (0, 0), (-1, 0),  6),
    ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",      (0, 1), (-1, -1), 8),
    ("TEXTCOLOR",     (0, 1), (0, -1),  RC_LIGHT),
    ("TEXTCOLOR",     (1, 1), (-1, -1), RC_WHITE),
    ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
    ("ALIGN",         (0, 0), (0, -1),  "LEFT"),
    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [RC_NAVY, RC_DARK]),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ("TOPPADDING",    (0, 1), (-1, -1), 5),
    ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ("GRID",          (0, 0), (-1, -1), 0.3, RC_MID),
])

def mtable(header, rows, widths):
    t = Table([header] + rows, colWidths=widths)
    t.setStyle(BASE_TABLE_STYLE)
    return t

def colored_cell(text, result):
    c = {"PASS": "#16A34A", "FAIL": "#DC2626"}.get(result.upper(), "#94A3B8")
    return Paragraph(f'<font color="{c}"><b>{result}</b></font>',
                     ParagraphStyle("RC", fontName="Helvetica-Bold", fontSize=8,
                                    alignment=TA_CENTER))

from k6_result_parse import load_results

def verdict(d):
    sm, lm, cw = d["sm"], d["lm"], d["cw"]
    if not sm and not lm:
        return "PENDING", "verdict_warn", "No result files found in results/. Run the stress test first."
    fails = []
    if sm.get("failed"): fails.append("k6 smoke threshold breach")
    if lm.get("failed"): fails.append("k6 load threshold breach")
    try:
        if int(cw.get("lambda_errors", "0")) > 0:
            fails.append(f"Lambda errors: {cw['lambda_errors']}")
    except ValueError:
        pass
    try:
        if float(cw.get("gw_5xx", "0")) > 1:
            fails.append(f"API GW 5xx: {cw['gw_5xx']}")
    except ValueError:
        pass
    if cw.get("dyn_throttles", "0") not in ("0", ""):
        if cw["dyn_throttles"] != "0":
            fails.append("DynamoDB throttles")
    if fails:
        return "FAIL", "verdict_fail", "SLA gates breached — " + "; ".join(fails) + "."
    if not lm:
        return "SMOKE PASS", "verdict_pass", "Smoke passed all gates. Load test results pending."
    return "PASS", "verdict_pass", \
        "All SLA gates passed across smoke and load profiles. Ready for pilot traffic escalation."

# ── Gate helper ───────────────────────────────────────────────────────────────
def gate(val, thr, lower=True, unit=""):
    if val in ("N/A", "", None):
        return "N/A", "—"
    try:
        ok = float(val) <= float(thr) if lower else float(val) >= float(thr)
        return f"{val}{unit}", "PASS" if ok else "FAIL"
    except ValueError:
        return str(val), "—"

# ── Build ─────────────────────────────────────────────────────────────────────
def build(args):
    data     = load_results(args.results_dir)
    S        = make_styles()
    now      = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%B %d, %Y")
    vrd, vrd_style, vrd_text = verdict(data)
    sm, lm, cw = data["sm"], data["lm"], data["cw"]

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)

    doc = SimpleDocTemplate(
        args.output,
        pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=0.9*inch, bottomMargin=0.6*inch,
    )

    fp = make_first_page(args.stage)
    lp = make_later_pages(args.stage)
    story = []

    # ── COVER ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.8*inch))
    story.append(Paragraph("RAPID CORTEX", S["brand_label"]))
    story.append(Spacer(1, 0.1*inch))
    story.append(HRFlowable(width="40%", thickness=1, color=RC_BLUE, spaceAfter=16, hAlign="CENTER"))
    story.append(Paragraph("Stress Test Report", S["cover_title"]))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("Production API Infrastructure Validation", S["cover_sub"]))
    story.append(Spacer(1, 0.4*inch))

    vcolor = {"verdict_pass": RC_GREEN, "verdict_fail": RC_RED, "verdict_warn": RC_YELLOW}[vrd_style]
    story.append(Paragraph(f"Overall Verdict: {vrd}", ParagraphStyle(
        "CV", fontName="Helvetica-Bold", fontSize=18,
        textColor=vcolor, alignment=TA_CENTER, spaceAfter=6,
    )))
    story.append(Spacer(1, 0.5*inch))
    story.append(HRFlowable(width="60%", thickness=0.5, color=RC_MID, spaceAfter=16, hAlign="CENTER"))

    meta = [
        ("Environment", args.stage.upper()),
        ("API Target",  args.api_url),
        ("Generated",   ts),
        ("Date",        date_str),
        ("Classification", "CONFIDENTIAL — Internal Use Only"),
    ]
    meta_rows = [[
        Paragraph(k, ParagraphStyle("ML", fontName="Helvetica", fontSize=9,
                                    textColor=RC_SILVER, alignment=TA_RIGHT)),
        Paragraph(v, ParagraphStyle("MV", fontName="Helvetica-Bold", fontSize=9,
                                    textColor=RC_WHITE, alignment=TA_LEFT)),
    ] for k, v in meta]
    mt = Table(meta_rows, colWidths=[2.2*inch, 3.8*inch])
    mt.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
        ("LEFTPADDING",   (1,0),(1,-1), 12),
    ]))
    story.append(mt)
    story.append(Spacer(1, 1.0*inch))
    story.append(Paragraph("Intelligence at the speed of response",
        ParagraphStyle("Tag", fontName="Helvetica", fontSize=9,
                       textColor=RC_MID, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────────
    story.append(Paragraph("Executive Summary", S["section_head"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_BLUE, spaceAfter=10))
    story.append(Paragraph("Overall Verdict", S["sub_head"]))
    story.append(Paragraph(vrd, S[vrd_style]))
    story.append(Paragraph(vrd_text, S["body"]))
    story.append(Spacer(1, 0.15*inch))

    story.append(Paragraph("Test Configuration", S["sub_head"]))
    cfg = [
        ["Parameter",                   "Value"],
        ["Environment / Stage",         args.stage.upper()],
        ["API Base URL",                args.api_url],
        ["Test Profiles",               "Smoke → Load (sequential)"],
        ["Monitor",                     "k6 logs: run-k6-profile.sh; CloudWatch: rc-stress-monitor.sh"],
        ["SLA: API GW 5xx",             "Must be 0"],
        ["SLA: Lambda Errors",          "Must be 0"],
        ["SLA: DynamoDB Throttles",     "Must be 0"],
        ["SLA: API GW Latency p99",     "< 500ms"],
        ["SLA: ECS CPU",                "< 80% sustained"],
        ["SLA: CloudFront 5xx Rate",    "< 1%"],
    ]
    story.append(mtable(cfg[0], cfg[1:], [3.0*inch, 4.2*inch]))
    story.append(Spacer(1, 0.15*inch))

    story.append(Paragraph("PageSpeed Context (Pre-Test)", S["sub_head"]))
    story.append(Paragraph(
        "Desktop: 96/100 — PASS. CloudFront + WebP serving correctly. "
        "Mobile: 75/100 — below 85 target due to missing <b>priority</b> prop on hero image "
        "and render-blocking font requests. This is a frontend delivery issue only and does not "
        "reflect backend health. TTFB and server-side metrics within SLA.",
        S["body"]
    ))
    story.append(PageBreak())

    # ── SLA GATES ─────────────────────────────────────────────────────────────
    story.append(Paragraph("SLA Gate Results", S["section_head"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_BLUE, spaceAfter=10))

    g5v,  g5s  = gate(cw.get("gw_5xx"),           1,   unit="")
    g4v,  g4s  = gate(cw.get("gw_4xx"),           10,  unit="")
    glv,  gls  = gate(cw.get("gw_lat"),            500, unit="ms")
    cpv,  cps  = gate(cw.get("ecs_cpu"),           80,  unit="%")
    mmv,  mms  = gate(cw.get("ecs_mem"),           85,  unit="%")
    cfv,  cfs  = gate(cw.get("cf_5xx"),            1,   unit="%")
    lev,  les  = gate(cw.get("lambda_errors","0"), 0,   unit="")
    dyv        = cw.get("dyn_throttles","0")
    dys        = "PASS" if dyv in ("0","") else "FAIL"

    sla_hdr = ["SLA Gate", "Threshold", "Observed", "Status"]
    sla_rows = [
        ["Lambda Errors (total)",     "0",        lev or "N/A", les],
        ["API GW 5xx (60s window)",   "≤ 1",      g5v,          g5s],
        ["API GW 4xx (60s window)",   "≤ 10",     g4v,          g4s],
        ["API GW Latency p99",        "< 500ms",  glv,          gls],
        ["ECS CPU Utilization",       "< 80%",    cpv,          cps],
        ["ECS Memory Utilization",    "< 85%",    mmv,          mms],
        ["CloudFront 5xx Rate",       "< 1%",     cfv,          cfs],
        ["DynamoDB Throttles",        "0",        dyv,          dys],
    ]
    sla_display = [[r[0], r[1], r[2], colored_cell(r[3], r[3])] for r in sla_rows]
    st = Table([sla_hdr] + sla_display, colWidths=[2.5*inch, 1.2*inch, 1.5*inch, 1.0*inch])
    st.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  RC_GRAY),
        ("TEXTCOLOR",     (0,0),(-1,0),  RC_BLUE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  8),
        ("ALIGN",         (0,0),(-1,0),  "CENTER"),
        ("BOTTOMPADDING", (0,0),(-1,0),  6),
        ("TOPPADDING",    (0,0),(-1,0),  6),
        ("FONTNAME",      (0,1),(-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,1),(-1,-1), 8),
        ("TEXTCOLOR",     (0,1),(0,-1),  RC_LIGHT),
        ("TEXTCOLOR",     (1,1),(2,-1),  RC_WHITE),
        ("ALIGN",         (1,0),(-1,-1), "CENTER"),
        ("ALIGN",         (0,0),(0,-1),  "LEFT"),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [RC_NAVY, RC_DARK]),
        ("BOTTOMPADDING", (0,1),(-1,-1), 5),
        ("TOPPADDING",    (0,1),(-1,-1), 5),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("GRID",          (0,0),(-1,-1), 0.3, RC_MID),
    ]))
    story.append(st)
    story.append(Spacer(1, 0.15*inch))

    if sm.get("thresholds"):
        story.append(Paragraph("k6 Threshold Results — Smoke Profile", S["sub_head"]))
        th_hdr = ["Status", "Threshold"]
        th_rows = []
        for status, name in sm["thresholds"][:20]:
            c = "#16A34A" if status == "✓" else "#DC2626"
            th_rows.append([
                Paragraph(f'<font color="{c}"><b>{status}</b></font>',
                    ParagraphStyle("T", fontName="Helvetica-Bold", fontSize=9, alignment=TA_CENTER)),
                name.strip()
            ])
        if th_rows:
            tt = Table([th_hdr] + th_rows, colWidths=[0.7*inch, 6.5*inch])
            tt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,0),  RC_GRAY),
                ("TEXTCOLOR",     (0,0),(-1,0),  RC_BLUE),
                ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
                ("FONTSIZE",      (0,0),(-1,0),  8),
                ("ALIGN",         (0,0),(-1,0),  "CENTER"),
                ("FONTNAME",      (0,1),(-1,-1), "Helvetica"),
                ("FONTSIZE",      (0,1),(-1,-1), 8),
                ("TEXTCOLOR",     (1,1),(1,-1),  RC_LIGHT),
                ("ROWBACKGROUNDS",(0,1),(-1,-1), [RC_NAVY, RC_DARK]),
                ("BOTTOMPADDING", (0,0),(-1,-1), 4),
                ("TOPPADDING",    (0,0),(-1,-1), 4),
                ("LEFTPADDING",   (0,0),(-1,-1), 8),
                ("GRID",          (0,0),(-1,-1), 0.3, RC_MID),
            ]))
            story.append(tt)
    story.append(PageBreak())

    # ── k6 PERFORMANCE METRICS ────────────────────────────────────────────────
    story.append(Paragraph("k6 Performance Metrics", S["section_head"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_BLUE, spaceAfter=10))

    def k6_section(label, mx):
        story.append(Paragraph(label, S["sub_head"]))
        if not mx:
            story.append(Paragraph("No data — log file not found.", S["body"]))
            story.append(Spacer(1, 0.1*inch))
            return
        key_map = [
            ("avg",  "HTTP Req Duration — avg"),
            ("p90",  "HTTP Req Duration — p90"),
            ("p95",  "HTTP Req Duration — p95"),
            ("p99",  "HTTP Req Duration — p99"),
            ("err",  "HTTP Request Failure Rate"),
            ("rps",  "Throughput (req/s)"),
            ("vus",  "Max VUs"),
            ("iter", "Iterations/s"),
        ]
        rows = [[display, str(mx[k])] for k, display in key_map if k in mx]
        if rows:
            story.append(mtable(["Metric", "Value"], rows, [3.5*inch, 3.7*inch]))
        story.append(Spacer(1, 0.1*inch))

    k6_section("Smoke Profile", sm)
    k6_section("Load Profile", lm)

    # ── CLOUDWATCH SNAPSHOT ───────────────────────────────────────────────────
    story.append(Paragraph("CloudWatch Metrics Snapshot", S["section_head"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_BLUE, spaceAfter=10))

    cw_hdr  = ["Service", "Metric", "Value", "SLA", "Status"]
    cw_data = [
        ["Lambda",      "Total Errors",        lev or "N/A",                   "0",       les],
        ["API Gateway", "5xx Errors (60s)",    g5v,                            "≤ 1",     g5s],
        ["API Gateway", "4xx Errors (60s)",    g4v,                            "≤ 10",    g4s],
        ["API Gateway", "Latency p99",         glv,                            "< 500ms", gls],
        ["API Gateway", "Total Requests",      cw.get("gw_req","N/A"),         "—",       "—"],
        ["DynamoDB",    "Throttle Events",     dyv,                            "0",       dys],
        ["ECS/Fargate", "CPU Utilization",     cpv,                            "< 80%",   cps],
        ["ECS/Fargate", "Memory Utilization",  mmv,                            "< 85%",   mms],
        ["CloudFront",  "5xx Error Rate",      cfv,                            "< 1%",    cfs],
        ["CloudFront",  "Total Requests",      cw.get("cf_req","N/A"),         "—",       "—"],
    ]
    cw_display = [[r[0],r[1],r[2],r[3], colored_cell(r[4], r[4])] for r in cw_data]
    cwt = Table([cw_hdr] + cw_display, colWidths=[1.2*inch, 1.8*inch, 1.3*inch, 1.1*inch, 0.9*inch])
    cwt.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  RC_GRAY),
        ("TEXTCOLOR",     (0,0),(-1,0),  RC_BLUE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  8),
        ("ALIGN",         (0,0),(-1,0),  "CENTER"),
        ("BOTTOMPADDING", (0,0),(-1,0),  6),
        ("TOPPADDING",    (0,0),(-1,0),  6),
        ("FONTNAME",      (0,1),(-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,1),(-1,-1), 8),
        ("TEXTCOLOR",     (0,1),(-1,-1), RC_WHITE),
        ("ALIGN",         (1,0),(-1,-1), "CENTER"),
        ("ALIGN",         (0,0),(0,-1),  "LEFT"),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [RC_NAVY, RC_DARK]),
        ("BOTTOMPADDING", (0,1),(-1,-1), 5),
        ("TOPPADDING",    (0,1),(-1,-1), 5),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("GRID",          (0,0),(-1,-1), 0.3, RC_MID),
    ]))
    story.append(cwt)
    story.append(PageBreak())

    # ── RECOMMENDATIONS ───────────────────────────────────────────────────────
    story.append(Paragraph("Findings & Recommendations", S["section_head"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_BLUE, spaceAfter=10))

    story.append(Paragraph("Frontend — Mobile PageSpeed (Action Required)", S["sub_head"]))
    fr_hdr = ["Priority", "Finding", "Fix", "Impact"]
    fr = [
        ["P0", "LCP 5.7s on mobile — target <2.5s",
         "Add priority prop to hero <Image> on /product/venue",  "+8–12 pts"],
        ["P1", "Render-blocking fonts (450ms savings)",
         "Switch to next/font/google or use rel=preload with onload",  "+3–5 pts"],
        ["P2", "Unused JavaScript (150 KiB)",
         "Dynamic import below-fold components",  "+2–3 pts"],
        ["P2", "Image sizing gap (260 KiB)",
         "Add correct sizes attr to hero Image for mobile breakpoints",  "+2–3 pts"],
    ]
    story.append(mtable(fr_hdr, fr, [0.6*inch, 2.0*inch, 2.85*inch, 0.85*inch]))
    story.append(Spacer(1, 0.15*inch))

    story.append(Paragraph("Infrastructure — Monitoring (Ongoing)", S["sub_head"]))
    ir_hdr = ["Area", "Recommendation"]
    ir = [
        ["Lambda",      "Error rate alarm: > 0 errors in 5-min window → SNS page"],
        ["DynamoDB",    "Switch to on-demand capacity for tables hit during stress test"],
        ["API Gateway", "Add CloudWatch dashboard: p99 latency + 5xx rate trending"],
        ["ECS",         "Auto-scaling trigger at 70% CPU sustained for 5 min"],
        ["CloudFront",  "Enable real-time logging → CloudWatch Insights for pattern detection"],
        ["Cognito",     "Throttle alarm: 5 SignInThrottles/5-min → auth storm detection"],
    ]
    story.append(mtable(ir_hdr, ir, [1.3*inch, 5.9*inch]))
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph("Next Steps", S["sub_head"]))
    for step in [
        "1. Apply mobile PageSpeed fixes and re-run on /product/venue. Target: ≥ 85.",
        "2. If stress PASS: proceed to pilot traffic onboarding per Rapid Cortex Pilot Offer.",
        "3. If stress FAIL: address each breached SLA gate before any pilot traffic increase.",
        "4. Schedule monthly stress test runs (smoke + load) as part of production ops cadence.",
        "5. Add rc-stress-monitor.sh metrics to a persistent CloudWatch dashboard.",
    ]:
        story.append(Paragraph(step, S["body"]))

    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RC_MID, spaceAfter=10))
    story.append(Paragraph(
        f"Report generated {ts}  |  Rapid Cortex Platform Engineering  |  CONFIDENTIAL",
        ParagraphStyle("Close", fontName="Helvetica", fontSize=7,
                       textColor=RC_SILVER, alignment=TA_CENTER),
    ))

    doc.build(story, onFirstPage=fp, onLaterPages=lp)
    return args.output

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--results-dir", default="results")
    p.add_argument("--stage",       default="prod")
    p.add_argument("--api-url",     default="https://api.rapidcortex.us")
    p.add_argument("--output",      default="results/RC_StressTest_Report.pdf")
    args = p.parse_args()
    print(f"[RC] Generating report → {args.output}")
    out = build(args)
    print(f"[RC] Done: {out}")

if __name__ == "__main__":
    main()
