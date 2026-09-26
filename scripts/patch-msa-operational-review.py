#!/usr/bin/env python3
"""2026-09-20 operational review of NexCort iQ MSA Word templates (raw OOXML text swaps)."""
from __future__ import annotations

import shutil
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

REPLACEMENTS: list[tuple[str, str]] = [
    (
        "Effective Date: [Date]",
        "Effective Date: [Date]. Document control: Template last operationally reviewed 2026-09-20. Contracting entity: Apps on Demand LLC d/b/a NexCort iQ. This template is not a SOC 2 Type II report, CJIS certification, HIPAA certification, or FedRAMP authorization. Counsel review required before customer send.",
    ),
    (
        "Subject to the terms and conditions of this Agreement, Vendor shall provide to Agency access to and use of the NexCort iQ software platform (the 'Platform'), a cloud-based Software-as-a-Service (SaaS) solution specifically designed and optimized for emergency response operations, 911 call center management, public safety communications, and emergency dispatch services.",
        "Subject to the terms and conditions of this Agreement, Vendor shall provide to Agency access to and use of the NexCort iQ software platform (the 'Platform'), a cloud-based Software-as-a-Service (SaaS) solution for emergency communications assist, public safety operations, and related modules selected in the Statement of Work. The Platform is decision-support software for trained Agency personnel. It is not a 911 customer-premises equipment (CPE) system, not a Computer-Aided Dispatch system of record, and does not autonomously dispatch units.",
    ),
    (
        "The Services are designed to enhance efficiency, accuracy, and effectiveness of emergency call handling through advanced AI, ML, NLP, and cloud computing technologies.",
        "The Services are designed to enhance efficiency, accuracy, and effectiveness of emergency call handling through advanced AI, ML, NLP, and cloud computing technologies. Optional platform modules, if selected in the Statement of Work, include: PSAP / 911 dispatcher workspace; Campus Safety; Venue Safety; Hospital portal; Transit safety; Guest Assist and public NFC/QR intake (Information, Police/Security reporting, and Emergency call-911); and Call Assist for non-emergency / 311-style lines. Call Assist is not 911 CPE and does not replace a telecommunicator on the 911 chair. NFC/QR Emergency is a device call to 911; it is not Vendor-operated dispatch.",
    ),
    (
        "Live Streaming Transcription with &lt;2 second latency",
        "Near-real-time streaming transcription when the speech pipeline is enabled for the tenant (latency varies with audio quality and configuration; not a guaranteed SLA metric)",
    ),
    (
        "85% minimum accuracy with continuous ML improvement",
        "Confidence scoring and continuous model improvement; accuracy varies and is not guaranteed. Dispatcher review is required before safety-critical action (see Section 2.5.2)",
    ),
    (
        "Automatic real-time translation between 40+ languages:",
        "Real-time translation between languages enabled for the tenant (coverage is configured, not universal):",
    ),
    (
        "Automatic language detection within 3-5 seconds",
        "Automatic language detection when the multilingual pipeline is enabled",
    ),
    (
        "2-4 second translation latency",
        "Translation latency varies with audio quality, provider, and configuration; not a guaranteed SLA metric",
    ),
    (
        "CAD field auto-population",
        "Assisted population of NexCort iQ incident fields; write-back to Agency's vendor CAD system only if a named CAD integration is specified in the Statement of Work",
    ),
    (
        "Whisper coaching (supervisor talks to dispatcher, caller can't hear)",
        "Supervisor live monitoring of calls as implemented in the Platform; additional coaching modes only if specified in the Statement of Work",
    ),
    (
        "Silent Text Link: Secure one-time SMS link sent to callers who cannot speak safely. Dispatcher sends the link from the incident workspace; the caller responds via text in their mobile browser with no app download required. All messages are encrypted, logged to the incident record, and written to the immutable audit trail automatically. Live and E2E tested.",
        "Silent Text Link: Secure one-time SMS link sent to callers who cannot speak safely. Dispatcher sends the link from the incident workspace; the caller responds via text in their mobile browser with no app download required. Messages are encrypted, logged to the incident record, and written to the audit trail when the module is enabled for the tenant.",
    ),
    (
        "Caller Video Assist (WebRTC): Dispatcher sends a one-time SMS link; the caller's mobile browser streams live video to the dispatcher console via Kinesis Video Streams WebRTC. No app download required. Session is consent-gated, logged to the incident record, and supports venue camera integration via Ring Connect. Deployment in final validation.",
        "Caller Video Assist (WebRTC): When enabled for the tenant, dispatcher may send a one-time SMS link so the caller's mobile browser streams live video to the dispatcher console. No app download required. Session is consent-gated and logged to the incident record. Venue camera integration (including Ring Connect) is available only when that module is enabled and in scope of the Statement of Work.",
    ),
    (
        "Complete two-way synchronization. Incident data flows automatically to CAD on call completion. Status updates, unit assignments, and disposition codes flow back to NexCort iQ in real-time. Requires custom development based on CAD vendor API availability.",
        "Complete two-way synchronization only if a named CAD vendor, connector project, and write-back authorization are specified in an executed Statement of Work or CAD addendum. Automated CAD write-back is not a Day-1 default and is not enabled without that written scope. Status updates, unit assignments, and disposition codes flow back to NexCort iQ only to the extent the named connector supports them.",
    ),
    (
        "Vendor has experience integrating with major CAD systems: Motorola PremierOne, Tyler New World, Hexagon Intergraph, Central Square, Spillman. Integration approach, timeline, and fees defined in SOW based on Agency's specific CAD vendor and API availability.",
        "Vendor maintains a CAD connector program. Named-vendor integration (including Motorola PremierOne, Tyler New World, Hexagon Intergraph, Central Square, Spillman, or others) is in scope only when listed in the Statement of Work. Approach, timeline, and fees are defined per vendor program and API availability. Vendor does not represent certified bidirectional CAD for every vendor as a product default.",
    ),
    (
        "CAD system licenses, maintenance, support",
        "CAD system licenses, maintenance, support, and any CAD system-of-record functions",
    ),
    (
        "Radio communication systems, dispatch consoles",
        "Radio communication systems, 911 CPE, logging recorders, and dispatch consoles",
    ),
    (
        "Geographic redundancy across multiple AWS regions",
        "Hosted on AWS in the United States; primary region as specified in the Statement of Work (default US East / Northern Virginia). Multi-region failover only if specified in the Statement of Work",
    ),
    (
        "Mobile apps for iOS and Android",
        "Web access plus native iOS and Android field applications for QR/NFC programming and vertical operations as specified in the Statement of Work",
    ),
    (
        "ACH: Navy Federal Credit Union | Routing: [Secrets Manager] | Account: [Secrets Manager] | Account Name: Apps on Demand LLC",
        "ACH: Apps on Demand LLC — routing and account numbers appear on each invoice (not published in this template)",
    ),
    (
        "Wire: Navy Federal Credit Union | SWIFT: [Secrets Manager] | Account: [Secrets Manager] | Beneficiary: Apps on Demand LLC",
        "Wire: Apps on Demand LLC — beneficiary details appear on each invoice (not published in this template)",
    ),
    (
        "MFA required for all administrative accounts, privileged accounts, and accounts with access to sensitive functions",
        "MFA required for all production user accounts on Vendor's production identity pool, including standard end-user and administrative accounts",
    ),
    (
        "MFA available and recommended (but optional) for standard end-user accounts",
        "Federated SSO users may satisfy MFA at the Agency identity provider; password users on the production pool must complete MFA (TOTP; SMS MFA when the identity service issues an SMS challenge)",
    ),
    (
        "MFA methods supported: time-based one-time passwords (TOTP) via authenticator apps (Google Authenticator, Microsoft Authenticator, Authy), SMS-based codes, hardware security tokens (FIDO2/WebAuthn), or push notifications to mobile apps",
        "MFA methods supported in production: time-based one-time passwords (TOTP) via authenticator apps; SMS-based codes when issued by the identity service. Additional methods (FIDO2/WebAuthn or push) if enabled for the tenant",
    ),
    (
        "Password expiration: maximum ninety (90) days, with forced password change upon expiration",
        "Password complexity and rotation per Vendor's production authentication policy; production access additionally requires MFA as described below",
    ),
    (
        "Dispatcher: Frontline telecommunicator. Full live call workspace — AI-assisted triage, CAD entry and submission, real-time translation, caller media (Silent Text Link, Caller Video Assist, Pinpoint Location, photo intake), SOP Protocol AI. Cannot access QA scorecards, billing, or user management.",
        "Dispatcher: Frontline telecommunicator. Live call workspace — AI-assisted triage, NexCort iQ incident entry, real-time translation when enabled, caller media modules when enabled (Silent Text Link, Caller Video Assist, Pinpoint Location, photo intake), SOP Protocol AI when configured. Vendor CAD submission only if a CAD integration is in the Statement of Work. Cannot access QA scorecards, billing, or user management.",
    ),
    (
        "7.10.1 SOC 2 Type II Compliance",
        "7.10.1 SOC 2 Program",
    ),
    (
        "Vendor maintains SOC 2 Type II certification (Service Organization Control 2, Type II) covering the security, availability, and confidentiality of the Services. SOC 2 Type II audits are conducted annually by independent certified public accounting firms in accordance with AICPA standards.",
        "Vendor maintains a SOC 2 Type II observation and control program covering security, availability, and confidentiality of the Services. Until an independent CPA firm issues a SOC 2 Type II report, Vendor does not represent that it is SOC 2 Type II certified or that a Type II audit report is available. Vendor will provide Agency, under NDA, with current control descriptions and technical evidence consistent with that program, and will provide a Type II report within sixty (60) days after a CPA firm issues one.",
    ),
    (
        "The SOC 2 Type II audit report covers:",
        "When issued, a SOC 2 Type II audit report covers:",
    ),
    (
        "Vendor shall provide Agency with a copy of Vendor's current SOC 2 Type II audit report upon Agency's written request, subject to Agency executing Vendor's standard non-disclosure agreement protecting the confidentiality of the report. Vendor shall provide updated reports annually within sixty (60) days of report issuance.",
        "When a SOC 2 Type II report has been issued, Vendor shall provide Agency a copy upon written request, subject to Vendor's standard non-disclosure agreement, and shall provide updated reports annually within sixty (60) days of issuance. Until issuance, Vendor's obligation is to provide the control-program documentation described above, not a CPA attestation.",
    ),
    (
        "Vendor conducts annual penetration testing of the Services, infrastructure, and applications by qualified independent third-party security firms. Penetration tests are comprehensive assessments simulating real-world attacks to identify vulnerabilities.",
        "Vendor shall engage a qualified independent firm to perform penetration testing of the Services at least annually once such a test is contracted. Until a third-party test is completed, Vendor shall provide equivalent security-control documentation upon Agency's written request. Pen-test executive summaries, when available, are provided under confidentiality restrictions.",
    ),
    (
        "In addition to Vendor's SOC 2 audits and penetration tests, Agency may conduct its own security audits, assessments, and compliance reviews of Vendor's security controls and practices in accordance with Article 18 (Audit Rights). Agency may engage third-party security assessors to conduct such audits on Agency's behalf.",
        "In addition to Vendor's SOC 2 program and any penetration tests, Agency may conduct its own security audits, assessments, and compliance reviews of Vendor's security controls and practices in accordance with Article 18 (Audit Rights). Agency may engage third-party security assessors to conduct such audits on Agency's behalf.",
    ),
    (
        "Primary AWS Region: [Specify region, e.g., US-East-1 (Northern Virginia) or US-West-2 (Oregon)]",
        "Primary AWS Region: US-East-1 (Northern Virginia), unless a different United States region is specified in the Statement of Work",
    ),
    (
        "Backup/Disaster Recovery AWS Region: [Specify different US region for geographic redundancy]",
        "Backup/Disaster Recovery AWS Region: United States region as specified in the Statement of Work (may be the same region with intra-region resilience unless multi-region DR is contracted)",
    ),
    (
        "Vendor maintains a public status page accessible at status.rapidcortex.com (or similar URL) displaying current Service status and historical incident information. The status page shows:",
        "Vendor will provide a status URL (intended: status.rapidcortex.us) in the Statement of Work or operations packet when a public status page is available. Until that page is live, Agency is notified of material outages through the support channels in Article 9. When available, the status page shows:",
    ),
    (
        "Vendor maintains public status page at **status.rapidcortex.com** showing:",
        "When live, Vendor's public status page (intended: status.rapidcortex.us) shows:",
    ),
    (
        "SOC 2 Type II audit reports",
        "SOC 2 Type II audit reports when issued by a CPA firm; otherwise SOC 2-aligned control descriptions and technical evidence (not a Type II report)",
    ),
    (
        "In lieu of on-site audits, Agency may request Vendor's current SOC 2 Type II audit report covering security, availability, and confidentiality. Vendor shall provide reports within fifteen (15) business days, subject to Agency executing Vendor's NDA.",
        "In lieu of on-site audits, Agency may request Vendor's current SOC 2 Type II report covering security, availability, and confidentiality when a CPA firm has issued such a report. Vendor shall provide an issued report within fifteen (15) business days, subject to Agency executing Vendor's NDA. Until a Type II report is issued, Vendor shall provide control-program documentation under NDA in lieu of a CPA report.",
    ),
    (
        "Comply with applicable laws and CJIS requirements",
        "Comply with applicable laws and maintain CJIS-aligned controls (not a representation of CJIS certification)",
    ),
]

# Second-pass Exhibit A / SLA overclaim control (applied after first-pass text is already in the file).
ROUND2: list[tuple[str, str]] = [
    (
        "Vendor maintains information security controls that are aligned with and designed to meet the requirements of the FBI Criminal Justice Information Services (CJIS) Security Policy, as such Policy is updated from time to time. This alignment applies to all Vendor systems, facilities, personnel, and processes that access, process, transmit, store, or otherwise handle Criminal Justice Information (CJI) or Agency Data that may contain CJI.",
        "Vendor maintains information security controls aligned with the FBI Criminal Justice Information Services (CJIS) Security Policy, as updated from time to time. This is alignment, not a representation of formal CJIS certification or CSA attestation. Alignment applies to Vendor systems, facilities, personnel, and processes that access, process, transmit, store, or otherwise handle Criminal Justice Information (CJI) or Agency Data that may contain CJI.",
    ),
    (
        "Compliance certifications: AWS data centers certified to SOC 1, SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018, PCI DSS Level 1, FedRAMP High, and numerous other security standards and compliance frameworks",
        "Infrastructure note: Amazon Web Services publishes SOC, ISO, PCI, and FedRAMP authorizations for eligible AWS services. Those certifications apply to AWS, not to NexCort iQ as a FedRAMP-authorized, SOC 2 Type II-certified, or PCI-certified product.",
    ),
    (
        "Transcription Latency: Real-time transcription with latency of less than two (2) seconds from speech to text appearance",
        "Transcription Latency: Near-real-time transcription when enabled; latency varies with audio quality and configuration (target, not an SLA metric)",
    ),
    (
        "**Transcription Latency:** &lt; 2 seconds from speech to text appearance for real-time transcription",
        "**Transcription Latency:** Near-real-time when enabled; varies with audio quality (target, not an SLA metric)",
    ),
    (
        "Enhance Service for Non-English Speakers: Provide real-time translation of emergency calls in 40+ languages, ensuring that language barriers do not delay emergency response or compromise service quality",
        "Enhance Service for Non-English Speakers: Provide real-time translation of emergency calls in languages enabled for the tenant. Translation assists trained personnel; it does not guarantee that language barriers are eliminated or that response times improve.",
    ),
    (
        "Integrate with Existing CAD System: Seamlessly integrate the Platform with Agency's existing Computer-Aided Dispatch (CAD) system to enable bi-directional data exchange and streamlined workflows",
        "Integrate with Existing CAD System (if selected in the Statement of Work): Connect NexCort iQ to Agency's Computer-Aided Dispatch system per a named-vendor connector. Bi-directional write-back is not a Day-1 default and is not enabled without written SOW scope. NexCort iQ is not the CAD of record.",
    ),
    (
        "Ensure CJIS Compliance: Implement the Platform with security controls aligned with FBI CJIS Security Policy requirements to protect criminal justice information",
        "CJIS Alignment: Implement the Platform with security controls aligned with FBI CJIS Security Policy requirements to protect criminal justice information (not a representation of CJIS certification)",
    ),
    (
        "Automatic speech-to-text transcription of all emergency calls in real-time with target latency less than 2 seconds",
        "Automatic speech-to-text transcription of calls on enabled channels when the speech pipeline is on; latency varies and is not a guaranteed SLA metric",
    ),
    (
        "Transcription accuracy target of 85% or higher under normal conditions (clear audio, standard accents)",
        "Transcription accuracy varies with audio quality, noise, and accents and is not guaranteed. Dispatcher review is required before safety-critical action.",
    ),
    (
        "Real-time translation of emergency calls in 40+ languages including Spanish, Chinese (Mandarin and Cantonese), Vietnamese, Korean, Arabic, Tagalog, Russian, French, German, and others",
        "Real-time translation of emergency calls in languages enabled for the tenant (examples may include Spanish, Chinese, Vietnamese, Korean, Arabic, Tagalog, Russian, French, German, and others as configured — coverage is not universal)",
    ),
    (
        "One-click transfer of extracted data to CAD system (when integrated)",
        "Assisted transfer of extracted NexCort iQ incident data to Agency CAD only when a named CAD integration is in the Statement of Work",
    ),
    (
        "Phase 3: Full CAD Control** - Ability to create, update, and dispatch units directly from NexCort iQ interface",
        "Phase 3: Bidirectional CAD (SOW-gated)** - Create/update NexCort iQ incident records and, only if a named CAD write-back connector and authorization are in an executed Statement of Work, submit approved data to Agency CAD. NexCort iQ is not the CAD of record and does not autonomously dispatch units.",
    ),
    (
        "Phase 2: Bi-Directional Sync** - Two-way synchronization of incident data between NexCort iQ and CAD",
        "Phase 2: Assisted / bidirectional sync (SOW-gated)** - Two-way synchronization of incident data only if a named CAD connector is in the Statement of Work",
    ),
    (
        "Extended Language Support** - Support for additional languages beyond standard 40+ languages",
        "Extended Language Support** - Additional languages beyond the tenant's enabled set, if contracted",
    ),
    (
        "Platform performance meets specifications in Section A.2 (transcription latency &lt;2 seconds, translation response time, etc.)",
        "Platform performance is consistent with the goals in Section A.2 (transcription/translation latency and accuracy vary and are not guaranteed SLA metrics)",
    ),
]

# Undo accidental second-pass doubling of replacements whose old text is a prefix of new.
DEDUPE: list[tuple[str, str]] = [
    (
        "Effective Date: [Date]. Document control: Template last operationally reviewed 2026-09-20. Contracting entity: Apps on Demand LLC d/b/a NexCort iQ. This template is not a SOC 2 Type II report, CJIS certification, HIPAA certification, or FedRAMP authorization. Counsel review required before customer send.. Document control: Template last operationally reviewed 2026-09-20. Contracting entity: Apps on Demand LLC d/b/a NexCort iQ. This template is not a SOC 2 Type II report, CJIS certification, HIPAA certification, or FedRAMP authorization. Counsel review required before customer send.",
        "Effective Date: [Date]. Document control: Template last operationally reviewed 2026-09-20. Contracting entity: Apps on Demand LLC d/b/a NexCort iQ. This template is not a SOC 2 Type II report, CJIS certification, HIPAA certification, or FedRAMP authorization. Counsel review required before customer send.",
    ),
    (
        "CAD system licenses, maintenance, support, and any CAD system-of-record functions, and any CAD system-of-record functions",
        "CAD system licenses, maintenance, support, and any CAD system-of-record functions",
    ),
    (
        "SOC 2 Type II audit reports when issued by a CPA firm; otherwise SOC 2-aligned control descriptions and technical evidence (not a Type II report) when issued by a CPA firm; otherwise SOC 2-aligned control descriptions and technical evidence (not a Type II report)",
        "SOC 2 Type II audit reports when issued by a CPA firm; otherwise SOC 2-aligned control descriptions and technical evidence (not a Type II report)",
    ),
]


def patch_core(xml: str) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    xml = re_sub_once(xml, r"(<dcterms:modified[^>]*>)[^<]*(</dcterms:modified>)", rf"\g<1>{now}\g<2>")
    xml = re_sub_once(xml, r"(<cp:lastModifiedBy[^>]*>)[^<]*(</cp:lastModifiedBy>)", r"\g<1>NexCort iQ operational review\g<2>")
    return xml


def re_sub_once(text: str, pattern: str, repl: str) -> str:
    import re

    return re.sub(pattern, repl, text, count=1)


def apply_document_xml(xml: str) -> tuple[str, list[str]]:
    missing: list[str] = []
    for old, new in REPLACEMENTS:
        if old not in xml:
            missing.append(old[:80])
            continue
        xml = xml.replace(old, escape(new) if "&" in new or "<" in new or ">" in new else new)
        # escape() would double-escape if we already used &lt; in old.
        # New strings from this script do not include raw < except we already used &lt; only in OLD.
        # Re-do: we should insert new as XML-escaped except we want apostrophes raw.
    return xml, missing


def apply_document_xml_safe(xml: str) -> tuple[str, list[str], int]:
    missing: list[str] = []
    hits = 0
    for old, new in DEDUPE:
        n = xml.count(old)
        if n:
            xml = xml.replace(old, escape(new))
            hits += n
    for old, new in REPLACEMENTS + ROUND2:
        escaped_new = escape(new)
        if escaped_new in xml or new in xml:
            continue
        n = xml.count(old)
        if n == 0:
            missing.append(old[:90])
            continue
        xml = xml.replace(old, escaped_new)
        hits += n
    return xml, missing, hits


def patch_docx(path: Path) -> tuple[int, list[str]]:
    backup = path.with_suffix(path.suffix + ".bak-2026-09-20")
    if not backup.exists():
        shutil.copy2(path, backup)
    buf = BytesIO()
    missing: list[str] = []
    hits = 0
    with zipfile.ZipFile(path, "r") as zin, zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                xml, missing, hits = apply_document_xml_safe(data.decode("utf-8"))
                data = xml.encode("utf-8")
            elif item.filename == "docProps/core.xml":
                data = patch_core(data.decode("utf-8")).encode("utf-8")
            zout.writestr(item, data)
    path.write_bytes(buf.getvalue())
    return hits, missing


def main() -> None:
    root = Path("/Volumes/Mac Mini/Coding Projects/NexCort iQ")
    files = [
        root / "NexCort iQ Internal Docs/COMPLETE_MSA_MASTER_DOCUMENT_updated.docx",
        root / "apps/web/public/docs/MASTER SERVICES AGREEMENT.docx",
    ]
    for f in files:
        hits, missing = patch_docx(f)
        print(f"{f.name}: {hits} replacements")
        for m in missing:
            print(f"  MISSING: {m}")


if __name__ == "__main__":
    main()
