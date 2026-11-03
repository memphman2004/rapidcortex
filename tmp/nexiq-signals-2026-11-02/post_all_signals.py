#!/usr/bin/env python3
"""
NexiQ Signal Discovery — 2026-11-02 Combined Posting Script
Run from any environment that can reach tbr4zvjlk5.execute-api.us-east-1.amazonaws.com

Usage:
    python3 post_all_signals.py

Posts 202 total payloads: 26 RFPs + 176 pre-RFP signals (all verticals)
Expected: 28 high / 139 medium / 35 low confidence
"""
import hashlib, json, os, urllib.request, urllib.error

API_ENDPOINT = "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/signals"

def _load_api_key():
    env = (os.environ.get("NEXIQ_SIGNALS_INGEST_API_KEY") or "").strip()
    if env:
        return env
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".ingest_key")
    if os.path.exists(key_path):
        return open(key_path).read().strip()
    raise SystemExit(
        "Missing ingest API key. Set NEXIQ_SIGNALS_INGEST_API_KEY or place .ingest_key beside this script."
    )

API_KEY = _load_api_key()

def sha256(agency, title, vertical):
    return hashlib.sha256(f"{agency}{title}{vertical}".encode()).hexdigest()

def normalize_payload(payload):
    """Coerce Civic IQ / Claude scratch shapes to nexiqSignalCreateBodySchema."""
    geo = payload.get("geography")
    if isinstance(geo, str):
        geo = {"state": geo.strip()}
    elif isinstance(geo, dict):
        geo = {k: v for k, v in geo.items() if v is not None}
        if not geo.get("state"):
            raise ValueError(f"geography.state required for {payload.get('title')!r}")
    else:
        raise ValueError(f"invalid geography for {payload.get('title')!r}")

    source_url = payload.get("sourceUrl") or ""
    agency_type = payload.get("agencyType") or ""
    # Zod strips unknown keys; keep only schema fields so nulls cannot trip validation.
    out = {
        "title": payload["title"],
        "summary": payload.get("summary") or "",
        "sourceUrl": source_url,
        "vertical": payload["vertical"],
        "agencyName": payload["agencyName"],
        "agencyType": agency_type,
        "geography": geo,
        "estimatedValue": payload.get("estimatedValue", None),
        "dueDate": payload.get("dueDate", None),
        "keywords": payload.get("keywords") or [],
        "confidenceScore": payload["confidenceScore"],
        "confidenceTier": payload["confidenceTier"],
        "dedupeHash": payload["dedupeHash"],
    }
    return out

def post_signal(payload):
    body = normalize_payload(payload)
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(
        API_ENDPOINT,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-nexcort-signals-key": API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)

def rfp(title, summary, vertical, geography, state, score, keywords,
        due_date=None, agency="the agency", estimated_value=None, source_url=None):
    tier = "high" if score >= 80 else ("medium" if score >= 60 else "low")
    return {
        "title": title,
        "summary": summary,
        "sourceUrl": source_url,
        "vertical": vertical,
        "agencyName": agency,
        "agencyType": None,
        "geography": geography,
        "estimatedValue": estimated_value,
        "dueDate": due_date,
        "keywords": keywords,
        "confidenceScore": score,
        "confidenceTier": tier,
        "status": "new",
        "sourceType": "rfp",
        "dedupeHash": sha256(agency, title, vertical)
    }

# ============================================================
# PART 1: RFPs (26 entries, sourced from Civic IQ open RFPs)
# ============================================================

rfp_payloads = [

# ===================== PSAP RFPs =====================

rfp("the agency - Evaluation of Public Safety Answering Point (PSAP) Consolidation - 2026-RFP-071-PR",
    "Soliciting proposals from qualified firms to conduct a comprehensive evaluation of potential PSAP consolidation, including assessment of CAD/RMS and NG911 telephony readiness, radio system interoperability, interfaces, data governance, and facilities readiness.",
    "core_psap", "WI", "WI", 75,
    ["PSAP", "NG911", "consolidation", "CAD", "radio interoperability", "dispatch", "911"],
    "2026-12-10T00:00:00"),

rfp("the agency - Dual-Lift 911 Dispatch Consoles - RFP #27-02 (2026)",
    "Requesting proposals for five commercial-grade dual-lift, sit/stand dispatch consoles for the new 911 Emergency Communications facility in Jackson, Georgia. Scope encompasses 4 dispatcher stations and 1 supervisor station for continuous 24/7 public safety PSAP operations.",
    "core_psap", "GA", "GA", 65,
    ["911 dispatch", "PSAP", "dispatch consoles", "supervisor station", "public safety"],
    "2026-11-19T00:00:00"),

rfp("the agency - Mass Notification System Procurement - 2026",
    "Seeking a mass notification system for emergency communication and alerting services. Submission deadline November 13, 2026.",
    "core_psap", "IL", "IL", 45,
    ["mass notification", "emergency communication", "alerting"],
    "2026-11-13T00:00:00"),

rfp("the agency - 911 - Solacom CHE Support (10/1/2026 - 9/30/2027) - SS 18326-27",
    "Seeking support services for 911 Solacom CHE telephony system from October 1, 2026 through September 30, 2027.",
    "core_psap", "FL", "FL", 55,
    ["911", "Solacom", "CHE support", "emergency communications", "telephony"],
    "2026-11-12T00:00:00"),

rfp("the agency Satellite Communications Services SS 18294-27",
    "Seeking satellite communications services to support existing emergency response and continuity-of-operations capabilities. Scope includes portable satellite phones, mobile deployable units, and fixed-site communications equipment.",
    "core_psap", "FL", "FL", 55,
    ["satellite communications", "emergency response", "COOP", "continuity of operations"],
    "2026-11-05T00:00:00"),

rfp("the agency - Public Safety Vehicle Equipment and Upfitting Services - RFB 27-018 (2026)",
    "Seeking bids for public safety vehicle equipment including emergency lighting, sirens, communication equipment, vehicle consoles and mounting systems, camera systems, and complete vehicle upfitting on as-needed basis.",
    "core_psap", "FL", "FL", 45,
    ["public safety", "emergency lighting", "sirens", "communication equipment", "camera systems"],
    "2026-12-03T00:00:00"),

rfp("the agency RFP 2026-15-122 Outdoor Emergency Warning Siren System Acquisition and Installation - 2026",
    "Soliciting proposals to furnish, deliver, install, configure, test, and commission an outdoor emergency warning siren system utilizing VHF radio communications, cellular IoT connectivity, and solar-powered operation.",
    "core_psap", "TX", "TX", 55,
    ["emergency warning siren", "VHF radio", "cellular IoT", "public safety alerting", "mass notification"],
    "2026-11-05T00:00:00"),

rfp("the agency - Maintenance & Repair – Two-Way Radio Equipment / Emergency Communications - Bid No. CR-8845-J7, 2026",
    "Seeking competitive bids for maintenance and repair services for two-way radio equipment including portable radios, mobile radios, PA/sirens, radio chargers for a Motorola Astro P25 800MHz simulcast system supporting approximately 2,000 terminals.",
    "core_psap", "MA", "MA", 55,
    ["two-way radio", "emergency communications", "P25", "Motorola Astro", "radio maintenance"],
    "2026-11-04T00:00:00"),

rfp("the agency Request for Proposals - Information Technology Services 2026",
    "Seeking proposals for managed IT services including 24/7 onsite and remote support, server and network support, backup services, and 911 center operations support. Three-year term with renewal options.",
    "core_psap", "PA", "PA", 55,
    ["IT managed services", "911 center support", "network support", "emergency communications"],
    "2026-11-12T00:00:00"),

rfp("the agency, MD - Countywide Multi-Hazard Environmental Monitoring and Decision-Support System RFP #27-150, 2026",
    "Seeking a configurable, scalable multi-hazard environmental monitoring and decision-support system including automated weather stations, air quality monitoring, centralized web-based monitoring platform integrating weather, precipitation, air quality, cameras, and wildfire monitoring.",
    "core_psap", "MD", "MD", 45,
    ["emergency preparedness", "environmental monitoring", "decision support", "multi-hazard", "cameras"],
    "2026-11-04T00:00:00"),

# ===================== CAMPUS RFPs =====================

rfp("the agency - Construction of Security Vestibules and Improvements for Select Schools - C-912-22 (2026)",
    "Seeking proposals for construction of security vestibules and improvements at multiple middle and high schools in Georgia, including installing storefront partitions, masonry work, and painting.",
    "campus", "GA", "GA", 60,
    ["security vestibules", "campus security", "school security improvements", "access control"],
    "2026-12-03T00:00:00"),

rfp("the agency - Security Cameras LEE/Churchill/Madison (Package A) RFP 11-27 2026",
    "Seeking proposals for removal and installation of security cameras at three high schools. Scope includes Axis cameras, Cat 6A cabling, integration into the Genetec system with 5-year licenses. Minimum 556 total camera replacements.",
    "campus", "TX", "TX", 60,
    ["security cameras", "campus surveillance", "Genetec", "Axis cameras", "school security"],
    "2026-11-09T00:00:00"),

rfp("University of California, the agency - Gayley Center Real Time Safety Center Prequalification - Project No. 940042.01 (2026)",
    "Prequalification for renovating 11,985 gsf of office space into a Real Time Safety Center to support critical safety operations for the UCLA campus and serve as the venue command post for the 2028 Summer Olympics and Paralympics. Includes dedicated server racks, data conduits, fire alarm, electrical. Estimated construction cost $4,237,000.",
    "campus", "CA", "CA", 65,
    ["real-time safety center", "campus safety", "command post", "security operations center", "Olympics"],
    "2026-11-05T00:00:00",
    agency="University of California, the agency",
    estimated_value=4237000),

rfp("the agency - Remote Security Solutions - RFI 013-27, 2026",
    "RFI gathering market research for remote security solutions for Transportation and Facilities Management vehicle and bus lots. Seeking remote surveillance, perimeter intrusion detection, motion sensors, radar, virtual perimeter systems, automated alerts, and AI-enabled camera systems.",
    "campus", "TX", "TX", 55,
    ["remote surveillance", "perimeter intrusion detection", "motion sensors", "campus security", "AI cameras"],
    "2026-11-20T00:00:00"),

rfp("the agency School Safety & Campus Management Software RFP27-005 (2026)",
    "Inviting proposals for installation of a building management system, facility security system, equipment, software, and related services.",
    "campus", "AR", "AR", 50,
    ["campus management software", "facility security system", "building management", "school safety"],
    "2026-11-11T00:00:00"),

rfp("Mehlville School District - School-Home Communication System RFP - 2026",
    "Requesting proposals for a comprehensive communications platform and automatic notification system for approximately 10,000 students, 2,100 employees across 18 schools supporting emergency notifications, absence notifications, and two-way translated communication in over 100 languages.",
    "campus", "MO", "MO", 55,
    ["emergency notifications", "mass communication", "campus communications", "notification system"],
    "2026-12-07T00:00:00",
    agency="Mehlville School District"),

rfp("the agency - Security Services 2026-2027",
    "Requesting sealed bids for security services for the 2026-2027 school year requiring six unarmed security officers and two substitutes to provide hallway monitoring, visitor check-in, de-escalation, and safety patrols.",
    "campus", "NJ", "NJ", 40,
    ["campus security", "security officers", "visitor check-in", "school safety"],
    "2026-11-17T00:00:00"),

rfp("the agency Schools E-Rate Category 2 and Security Cabling Infrastructure Services - RFP 2027-003-HR",
    "Seeking proposals for E-Rate Category 2 and Security Cabling Infrastructure Services at middle school including Category 6/6A re-cabling and security infrastructure drops including cameras, access control, vape detectors, and intercom units.",
    "campus", "NM", "NM", 55,
    ["security cameras", "access control", "intercom", "campus security infrastructure", "vape detectors"],
    "2026-12-03T00:00:00"),

rfp("the agency - 27TH09 Milestone Care+ XProtect 3-Year Support for Security System - 2026",
    "Seeking bids to provide Milestone Care+ XProtect 3-Year Support licenses for the district's security system.",
    "campus", "UT", "UT", 50,
    ["Milestone XProtect", "VMS", "video management system", "campus security", "security cameras"],
    "2026-11-04T00:00:00"),

rfp("the agency School District - Verkada Camera System Installation at the agency Elementary School - 2026",
    "Seeking proposals to furnish, install, and configure a comprehensive Verkada camera security system at an elementary school. Scope includes interior and exterior camera coverage, cloud-based software, network wiring, hardware integration, and viewing station installation with staff training.",
    "campus", "CT", "CT", 55,
    ["Verkada cameras", "school security", "campus surveillance", "cloud-based video surveillance"],
    "2026-11-12T00:00:00"),

rfp("the agency NC - Building Communication System Replacement - CCS-2026-AES-INTERCOM (2026)",
    "Soliciting quotations for provision, installation, and integration of a new IP-based building communication (intercom) system at an elementary school. Scope includes main unit console, interior and exterior speakers covering perimeter, play areas and parking, call buttons, to enhance school security and safety.",
    "campus", "NC", "NC", 55,
    ["school intercom", "campus communications", "IP-based intercom", "school security", "emergency notification"],
    "2026-11-05T00:00:00"),

# ===================== VENUE RFPs =====================

rfp("the agency - Ocean Center Event Staffing and Event Security Services - 26-P-124JJ (2026)",
    "Requesting proposals for trained personnel to provide event staffing, entry security checkpoint screening, and in-event crowd management security services for the Ocean Center Convention Center and Event Venue in Daytona Beach, Florida. Three service lines: ticket-taking/ushering, magnetometer screening/bag inspection, and crowd management for concerts and live entertainment events.",
    "venue", "FL", "FL", 80,
    ["event security", "checkpoint screening", "crowd management", "convention center", "magnetometer screening", "venue security"],
    "2026-12-09T00:00:00"),

rfp("the agency - IFB 2027-029 TSA Exit Lane Terminal Expansion",
    "Project includes expansion of the TSA security checkpoint with a new automated exit lane, renovation of the adjacent concessions waiting area, and construction of a new passenger elevator addition at a regional airport terminal building.",
    "venue", "VA", "VA", 70,
    ["TSA security checkpoint", "automated exit lane", "airport security", "venue security", "terminal expansion"],
    "2026-12-09T00:00:00"),

rfp("the agency - Security Light Upgrades - Bid Reference No. 27-027 (2026)",
    "Seeking competitive sealed bids for comprehensive citywide security light upgrades involving 12,346 tracked asset actions including LED retrofits for 2,552 units, decommissioning of 4,819 inactive security lights, and field inspections of 4,975 existing LED fixtures with GPS asset tracking.",
    "venue", "GA", "GA", 45,
    ["security lighting", "LED upgrades", "venue security", "public safety lighting", "GIS"],
    "2026-11-13T00:00:00"),

rfp("the agency - 2027 Security Services at Recreation Centers, Pools, and Playgrounds - RFP",
    "Requesting proposals for armed, uniformed, commissioned off-duty police officers or sheriffs to provide security services at approximately 21 recreation centers and 20 outdoor pools. Services include daily patrols, access control, traffic control, emergency response, and attendance logging.",
    "venue", "OH", "OH", 45,
    ["venue security", "security officers", "recreation center security", "access control", "emergency response"],
    "2026-11-10T00:00:00"),

rfp("the agency Annual Contract for Security Guard Services - RFB 25-26-40 (2026)",
    "Inviting qualified vendors to submit bids for an annual contract to provide security guard services at various City facilities and special events. Initial contract term is twelve months with options for four consecutive one-year renewals.",
    "venue", "CA", "CA", 45,
    ["security guard services", "venue security", "facility security", "event security"],
    "2026-11-17T00:00:00"),
]

# ============================================================
# PART 2: Pre-RFP Signals (176 entries, sourced from Civic IQ signals)
# Load from companion file signals_only.json if present, else skip
# ============================================================

def main():
    signal_payloads = []
    signals_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signals_only.json")
    if os.path.exists(signals_file):
        with open(signals_file) as f:
            signal_payloads = json.load(f)
        print(f"Loaded {len(signal_payloads)} signal payloads from signals_only.json")
    else:
        print(
            "WARNING: signals_only.json not found — posting RFPs only. "
            "Place signals_only.json in the same directory."
        )

    # Fix RFP geography: helper stored state as a bare string; API wants {state}.
    for r in rfp_payloads:
        if isinstance(r.get("geography"), str):
            r["geography"] = {"state": r["geography"]}

    all_payloads = rfp_payloads + signal_payloads
    print(f"\nTotal payloads to post: {len(all_payloads)}")
    print("=" * 70)

    results = {"posted": 0, "skipped": 0, "errors": [], "high": 0, "medium": 0, "low": 0}
    all_404 = True

    for r in all_payloads:
        status, body = post_signal(r)
        tier = r.get("confidenceTier", "low")
        short = (r.get("title") or "")[:70]
        is_dup = False
        if status in (200, 201):
            try:
                parsed = json.loads(body) if body else {}
                # API returns 200 {duplicate:true} (not 409) for existing dedupeHash
                if isinstance(parsed, dict) and (
                    parsed.get("duplicate") is True
                    or (
                        isinstance(parsed.get("data"), dict)
                        and parsed["data"].get("duplicate") is True
                    )
                ):
                    is_dup = True
            except Exception:
                pass

        if is_dup or status == 409:
            results["skipped"] += 1
            all_404 = False
            print(f"⚡ [DUP   ] {short}")
        elif status in (200, 201):
            results["posted"] += 1
            if tier in results:
                results[tier] += 1
            all_404 = False
            print(f"✓ [{tier.upper():<6}] {short}")
        elif status == 404:
            results["errors"].append(
                {"title": r.get("title", ""), "status": 404, "tier": tier, "payload": r}
            )
            print(f"⚠ [404   ] {short}")
        else:
            results["errors"].append(
                {
                    "title": r.get("title", ""),
                    "status": status,
                    "error": str(body)[:300],
                    "tier": tier,
                }
            )
            all_404 = False
            st_str = str(status) if status is not None else "ERR"
            print(f"✗ [{st_str:<6}] {short} | {str(body)[:100]}")

    print("\n" + "=" * 70)
    print(
        f"POSTED:  {results['posted']} "
        f"({results['high']} high / {results['medium']} medium / {results['low']} low)"
    )
    print(f"SKIPPED: {results['skipped']} (duplicate)")
    print(f"ERRORS:  {len(results['errors'])}")

    if all_404 and results["errors"]:
        print("\n⚠ ALL REQUESTS RETURNED 404 — stack may still be deploying.")
        print("Logging all payloads for manual re-submission:\n")
        for e in results["errors"]:
            if "payload" in e:
                print(f"--- {e['title']}")
                print(json.dumps(e["payload"]))
                print()
    elif results["errors"]:
        for e in results["errors"]:
            print(f"  [{e.get('status')}] {e['title'][:60]} | {e.get('error','')[:100]}")

    print(
        f"\nRFP_SUMMARY:{results['posted']}:{results['high']}:{results['medium']}:"
        f"{results['low']}:{results['skipped']}:{len(results['errors'])}"
    )


if __name__ == "__main__":
    main()
