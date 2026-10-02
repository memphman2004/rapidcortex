/** Feature architecture flow definitions — ported from NexCort feature architecture maps canvas. */

export type FlowId =
  | "ca_confirm"
  | "ca_full"
  | "psap_ai"
  | "multilang"
  | "qr_nfc"
  | "k12"
  | "cad"
  | "media_sms"
  | "vision"
  | "campus_events"
  | "translate"
  | "hospital"
  | "clery_dcl"
  | "eap"
  | "transit"
  | "automation"
  | "venue_guest"
  | "venue_qr"
  | "pickup"
  | "asr"
  | "cameras";

export type FlowDef = {
  id: FlowId;
  title: string;
  vertical: string;
  summary: string;
  source: string;
  nodes: Array<{ id: string; label: string; kind?: "start" | "action" | "branch" | "end" | "parallel" }>;
  edges: Array<{ from: string; to: string; label?: string }>;
};

export const FEATURE_ARCHITECTURE_FLOWS: FlowDef[] = [
  {
    id: "ca_confirm",
    title: "Call Assist — post-intake confirmation",
    vertical: "Call Assist",
    summary:
      "Matches the operator diagram: intake complete → PREFIX-MMDD-XXXX confirmation → parallel speak (NATO) / SMS / RoutingRule engine → notify channels or default supervisor queue.",
    source: "packages/shared/src/call-assist/case-number.ts · routing.ts · session-pipeline.ts",
    nodes: [
      { id: "intake", label: "Intake complete", kind: "start" },
      { id: "confirm", label: "Generate confirmation\nPREFIX-MMDD-XXXX", kind: "action" },
      { id: "nato", label: "Speak NATO-formatted number", kind: "parallel" },
      { id: "sms", label: "SMS if enabled\nand callback/ANI", kind: "parallel" },
      { id: "route", label: "routeCall\nRoutingRule engine", kind: "branch" },
      { id: "match", label: "Dashboard · email\nSMS · webhook", kind: "end" },
      { id: "nomatch", label: "Default supervisor queue", kind: "end" },
    ],
    edges: [
      { from: "intake", to: "confirm" },
      { from: "confirm", to: "nato" },
      { from: "confirm", to: "sms" },
      { from: "confirm", to: "route" },
      { from: "route", to: "match", label: "match" },
      { from: "route", to: "nomatch", label: "no match" },
    ],
  },
  {
    id: "ca_full",
    title: "Call Assist — live call path",
    vertical: "Call Assist",
    summary:
      "Amazon Connect → Lex dialog → triage/safety → emergency 911 transfer, human queue, external agency, self-service, or complete session with CAD/RMS draft hooks.",
    source: "session-pipeline.ts · lex/fulfillment-hook.ts · recommendRoute()",
    nodes: [
      { id: "ani", label: "Inbound call\n(ANI / Connect)", kind: "start" },
      { id: "session", label: "Create session\n+ case number", kind: "action" },
      { id: "lex", label: "Lex dialog\n+ slot intake", kind: "action" },
      { id: "triage", label: "Triage + safety\ngate", kind: "branch" },
      { id: "e911", label: "Transfer 911\n(warm / silent)", kind: "end" },
      { id: "human", label: "Live call taker\nqueue", kind: "end" },
      { id: "ext", label: "External agency\nPSTN/SIP", kind: "end" },
      { id: "done", label: "Complete +\naudit / CAD draft", kind: "end" },
    ],
    edges: [
      { from: "ani", to: "session" },
      { from: "session", to: "lex" },
      { from: "lex", to: "triage" },
      { from: "triage", to: "e911", label: "emergency" },
      { from: "triage", to: "human", label: "low conf / human" },
      { from: "triage", to: "ext", label: "external" },
      { from: "triage", to: "done", label: "complete" },
    ],
  },
  {
    id: "psap_ai",
    title: "PSAP — incident AI analysis",
    vertical: "PSAP / 911",
    summary:
      "Dispatcher workspace loads incident → transcript → orchestrated AI providers → Zod-validated triage JSON → protocol coaching → audit. Never invents protocol text.",
    source: "AI_ANALYSIS_ARCHITECTURE.md · AnalyzeIncident",
    nodes: [
      { id: "q", label: "Incident queue\nGET /api/incidents", kind: "start" },
      { id: "tx", label: "Transcript +\noptional analyze", kind: "action" },
      { id: "orch", label: "AI orchestrator\nprimary→secondary→tertiary", kind: "branch" },
      { id: "val", label: "Zod validate\n+ protocol packs", kind: "action" },
      { id: "persist", label: "Persist analysis\n+ audit event", kind: "end" },
      { id: "fail", label: "analysis.failed\n(no row)", kind: "end" },
    ],
    edges: [
      { from: "q", to: "tx" },
      { from: "tx", to: "orch" },
      { from: "orch", to: "val", label: "success" },
      { from: "orch", to: "fail", label: "chain fail" },
      { from: "val", to: "persist" },
    ],
  },
  {
    id: "multilang",
    title: "Multilingual call pipeline",
    vertical: "Language",
    summary:
      "Audio chunk → STT chain (Azure→Google→AWS) → detect language → translate to English when needed → persist original+English → optional auto-analyze.",
    source: "MULTILINGUAL_CALL_PIPELINE.md",
    nodes: [
      { id: "chunk", label: "Audio chunk\nPOST .../audio-chunks", kind: "start" },
      { id: "stt", label: "STT chain\nAzure → Google → AWS", kind: "action" },
      { id: "lang", label: "Non-English?", kind: "branch" },
      { id: "tr", label: "Translate chain\n→ English text", kind: "action" },
      { id: "pass", label: "Pass-through\nEnglish", kind: "action" },
      { id: "store", label: "Persist segment\n+ confidence flags", kind: "end" },
      { id: "ai", label: "Optional\nauto-analyze", kind: "end" },
    ],
    edges: [
      { from: "chunk", to: "stt" },
      { from: "stt", to: "lang" },
      { from: "lang", to: "tr", label: "yes" },
      { from: "lang", to: "pass", label: "no" },
      { from: "tr", to: "store" },
      { from: "pass", to: "store" },
      { from: "store", to: "ai" },
    ],
  },
  {
    id: "qr_nfc",
    title: "QR / NFC public safety report",
    vertical: "Campus · Venue · Transit",
    summary:
      "Scan → public intake → optional category → POST /api/public/report → agency-scoped incident/queue → ops console. Call number card for emergency escalation.",
    source: "QRNfcIntakeClient · qr-nfc-service · MobileCodes /api/codes",
    nodes: [
      { id: "scan", label: "QR/NFC scan\npublic page", kind: "start" },
      { id: "intent", label: "Scan intent\nchooser", kind: "action" },
      { id: "form", label: "Report form\n(+ category)", kind: "action" },
      { id: "api", label: "POST public report\nagency-scoped write", kind: "action" },
      { id: "ops", label: "Ops queue /\nreference code", kind: "end" },
      { id: "call", label: "Call security\n(sticky footer)", kind: "parallel" },
    ],
    edges: [
      { from: "scan", to: "intent" },
      { from: "intent", to: "form", label: "report" },
      { from: "intent", to: "call", label: "call" },
      { from: "form", to: "api" },
      { from: "api", to: "ops" },
    ],
  },
  {
    id: "k12",
    title: "K-12 concern intake",
    vertical: "Campus K-12",
    summary:
      "Eight parent groups → specific type → dynamic follow-ups → message prepend → district escalation policy by type severity (weapon, self-harm, custody, etc.).",
    source: "k12-intake.ts · K12ConcernPicker · K12_INCIDENT_TYPES",
    nodes: [
      { id: "grp", label: "Pick parent category\n(8 groups)", kind: "start" },
      { id: "type", label: "Select concern type\n(~44 types)", kind: "action" },
      { id: "fu", label: "Dynamic follow-ups\n(type or group default)", kind: "action" },
      { id: "msg", label: "Format answers\ninto report message", kind: "action" },
      { id: "submit", label: "Submit public /\nops report", kind: "end" },
      { id: "esc", label: "Escalation / lockdown\nflags by type", kind: "parallel" },
    ],
    edges: [
      { from: "grp", to: "type" },
      { from: "type", to: "fu" },
      { from: "type", to: "esc" },
      { from: "fu", to: "msg" },
      { from: "msg", to: "submit" },
    ],
  },
  {
    id: "cad",
    title: "CAD write-back (fail-closed)",
    vertical: "Integrations",
    summary:
      "Assisted path only when agency-approved. RoutingEngine matches rules → healthy connector → dispatcher attestation. Automated write-back blocked in product until governance clears.",
    source: "CadRoutingEngine · evaluateCadWriteBackGuards · FEATURE_REGISTRY",
    nodes: [
      { id: "inc", label: "Unified CAD\nincident payload", kind: "start" },
      { id: "gate", label: "Write-back guards\n(mode · approval · audit)", kind: "branch" },
      { id: "blocked", label: "Blocked /\nread-only", kind: "end" },
      { id: "rules", label: "CadRoutingEngine\npriority rules", kind: "branch" },
      { id: "conn", label: "Target connector\n(healthy + dept)", kind: "action" },
      { id: "attest", label: "Dispatcher\nattestation", kind: "action" },
      { id: "wb", label: "Vendor submit\n+ audit", kind: "end" },
      { id: "noroute", label: "No route /\nmismatch", kind: "end" },
    ],
    edges: [
      { from: "inc", to: "gate" },
      { from: "gate", to: "blocked", label: "disabled" },
      { from: "gate", to: "rules", label: "allowed" },
      { from: "rules", to: "conn", label: "match" },
      { from: "rules", to: "noroute", label: "no match" },
      { from: "conn", to: "attest" },
      { from: "attest", to: "wb" },
    ],
  },
  {
    id: "media_sms",
    title: "Incident media SMS",
    vertical: "Media / evidence",
    summary:
      "Dispatcher requests secure upload link → tokenized URL via AWS End User Messaging → caller uploads → media attached to incident. No CAD/PII in SMS body.",
    source: "INCIDENT_MEDIA_SMS.md",
    nodes: [
      { id: "disp", label: "Dispatcher requests\nmedia from caller", kind: "start" },
      { id: "tok", label: "Create media\nupload token", kind: "action" },
      { id: "sms", label: "SMS secure link\n(10DLC / mock)", kind: "action" },
      { id: "up", label: "Caller upload\n/media/upload/{token}", kind: "action" },
      { id: "attach", label: "Attach to incident\n+ audit", kind: "end" },
    ],
    edges: [
      { from: "disp", to: "tok" },
      { from: "tok", to: "sms" },
      { from: "sms", to: "up" },
      { from: "up", to: "attach" },
    ],
  },
  {
    id: "vision",
    title: "Rapid Vision session",
    vertical: "Vision / video",
    summary:
      "Authorized role starts session → KVS / WebRTC → optional transcript worker + SageMaker detector → WebSocket push (data envelope) → dispatcher LIVE tab.",
    source: "rapid-cortex-global-features §11 · VisionHttpFunction",
    nodes: [
      { id: "auth", label: "canRequestVisionAccess\n+ account checks", kind: "start" },
      { id: "sess", label: "Start vision session\nINCIDENT# / SESSION#", kind: "action" },
      { id: "media", label: "KVS HLS / WebRTC\nviewer token", kind: "action" },
      { id: "work", label: "Transcript worker\n+ detector (scheduled)", kind: "parallel" },
      { id: "ws", label: "WS push\nrapid-vision.* + data{}", kind: "action" },
      { id: "ui", label: "Dispatcher LIVE tab\nsegments / cameras", kind: "end" },
    ],
    edges: [
      { from: "auth", to: "sess" },
      { from: "sess", to: "media" },
      { from: "media", to: "work" },
      { from: "media", to: "ws" },
      { from: "work", to: "ws" },
      { from: "ws", to: "ui" },
    ],
  },
  {
    id: "campus_events",
    title: "Campus inbound security events",
    vertical: "Campus",
    summary:
      "Signed webhook from VMS/ALPR/alarm → map type → create campus incident → attach cameras/EAP. Lockdown & CAD write-back stay fail-closed.",
    source: "CAMPUS_SECURITY_EVENTS.md",
    nodes: [
      { id: "hook", label: "POST security-events\nHMAC / token", kind: "start" },
      { id: "map", label: "Map source/type\n→ incident type", kind: "action" },
      { id: "inc", label: "Create campus\nincident", kind: "action" },
      { id: "cam", label: "Attach nearest\ncameras + EAP", kind: "parallel" },
      { id: "ops", label: "Campus console\nqueue", kind: "end" },
    ],
    edges: [
      { from: "hook", to: "map" },
      { from: "map", to: "inc" },
      { from: "inc", to: "cam" },
      { from: "inc", to: "ops" },
    ],
  },
  {
    id: "translate",
    title: "Live Translate session",
    vertical: "Field · Campus · Venue",
    summary:
      "Authorized field role opens Translate → live WS session → STT/translate/TTS loop → optional writeback to incident notes. Feature-flagged; RBAC in shared authz.",
    source: "translate handlers · mobile TranslateScreen · authz.ts",
    nodes: [
      { id: "role", label: "Translate RBAC\n+ feature flag", kind: "start" },
      { id: "open", label: "Start live session\nHTTP + WS", kind: "action" },
      { id: "loop", label: "Audio → STT →\nTranslate → TTS", kind: "action" },
      { id: "ui", label: "Field UI captions\n+ playback", kind: "end" },
      { id: "wb", label: "Optional writeback\nto incident", kind: "end" },
    ],
    edges: [
      { from: "role", to: "open" },
      { from: "open", to: "loop" },
      { from: "loop", to: "ui" },
      { from: "loop", to: "wb" },
    ],
  },
  {
    id: "hospital",
    title: "Hospital capacity & diversion",
    vertical: "Hospital",
    summary:
      "Staff/admin update ER/ICU/trauma beds + diversion → portal capacity API → live header strip for coordinators. Diversion threshold can trigger contact notifications; EMS pre-alerts are a separate inbound path.",
    source: "capacity-update-form · /api/hospital-portal/capacity · hospital-role-header-strip",
    nodes: [
      { id: "staff", label: "Hospital staff/admin\ncapacity form", kind: "start" },
      { id: "upd", label: "POST capacity\n(beds · wait · diversion)", kind: "action" },
      { id: "store", label: "Persist portal\ncapacity record", kind: "action" },
      { id: "thresh", label: "Below diversion\nthreshold?", kind: "branch" },
      { id: "notify", label: "Diversion contacts\n/ status ALERT", kind: "end" },
      { id: "live", label: "Coordinator strip\nER/ICU · Open|Diversion", kind: "end" },
      { id: "pre", label: "EMS pre-alert\n(inbound)", kind: "parallel" },
    ],
    edges: [
      { from: "staff", to: "upd" },
      { from: "upd", to: "store" },
      { from: "store", to: "thresh" },
      { from: "store", to: "live" },
      { from: "thresh", to: "notify", label: "yes / on diversion" },
      { from: "thresh", to: "live", label: "open" },
      { from: "pre", to: "live" },
    ],
  },
  {
    id: "clery_dcl",
    title: "Clery Act → Daily Crime Log",
    vertical: "Campus · Clery",
    summary:
      "Campus incident → Clery record (AI suggestion advisory) → coordinator classify → DCL entry within statutory deadline. AI never auto-publishes to the Daily Crime Log.",
    source: "clery-act/service.ts · campus-clery-review-client · calculateDCLDeadline",
    nodes: [
      { id: "inc", label: "Campus incident\ncreated / synced", kind: "start" },
      { id: "rec", label: "Create Clery record\nPENDING_REVIEW", kind: "action" },
      { id: "ai", label: "AI suggest offense\n+ geography (advisory)", kind: "parallel" },
      { id: "dl", label: "Set DCL deadline\n(statutory clock)", kind: "action" },
      { id: "coord", label: "Clery Coordinator\nclassify / confirm", kind: "branch" },
      { id: "excl", label: "Excluded /\nnot reportable", kind: "end" },
      { id: "dcl", label: "Daily Crime Log\nentry + audit", kind: "end" },
      { id: "over", label: "Overdue flag\nif past deadline", kind: "end" },
    ],
    edges: [
      { from: "inc", to: "rec" },
      { from: "rec", to: "ai" },
      { from: "rec", to: "dl" },
      { from: "ai", to: "coord" },
      { from: "dl", to: "coord" },
      { from: "coord", to: "excl", label: "exclude" },
      { from: "coord", to: "dcl", label: "confirm" },
      { from: "dl", to: "over", label: "missed" },
    ],
  },
  {
    id: "eap",
    title: "Campus EAP / checklist attach",
    vertical: "Campus",
    summary:
      "On incident finalize: match active EAP by building + incident type (building-specific, else *). Attach checklist steps + nearest cameras. Automation may notify roles; lockdown/CAD stay fail-closed.",
    source: "matchCampusEap · finalizeCampusIntakeIncident · campus-eap-service",
    nodes: [
      { id: "fin", label: "Finalize campus\nintake incident", kind: "start" },
      { id: "cam", label: "Nearest cameras\n(building/zone/QR)", kind: "parallel" },
      { id: "match", label: "matchCampusEap\nbuilding + type", kind: "branch" },
      { id: "hit", label: "Attach EAP checklist\nsteps + doc URL", kind: "action" },
      { id: "miss", label: "No EAP\n(continue)", kind: "action" },
      { id: "bcast", label: "Realtime broadcast\n+ console queue", kind: "end" },
      { id: "auto", label: "Automation rules\nnotify / war room", kind: "parallel" },
    ],
    edges: [
      { from: "fin", to: "cam" },
      { from: "fin", to: "match" },
      { from: "match", to: "hit", label: "match" },
      { from: "match", to: "miss", label: "no match" },
      { from: "hit", to: "bcast" },
      { from: "miss", to: "bcast" },
      { from: "cam", to: "bcast" },
      { from: "fin", to: "auto" },
    ],
  },
  {
    id: "transit",
    title: "Transit QR → ops incident",
    vertical: "Transit",
    summary:
      "Public QR/NFC intake on vehicle/station/route → createTransitQrIncident → attach place cameras → realtime broadcast to transit console. Escalate-to-911 is explicit, not automatic.",
    source: "transit-service.createTransitQrIncident · getCamerasForTransitPlace",
    nodes: [
      { id: "scan", label: "Transit QR/NFC\nscan + report", kind: "start" },
      { id: "create", label: "createTransitQrIncident\nvehicle/station/route", kind: "action" },
      { id: "cams", label: "Cameras for\ntransit place", kind: "parallel" },
      { id: "audit", label: "Audit\nTRANSIT_INCIDENT_CREATED", kind: "action" },
      { id: "rt", label: "Realtime broadcast\ntransit.incident.created", kind: "action" },
      { id: "ops", label: "Transit console\nsecurity/operator", kind: "end" },
      { id: "911", label: "Escalate to 911\n(explicit)", kind: "end" },
    ],
    edges: [
      { from: "scan", to: "create" },
      { from: "create", to: "cams" },
      { from: "create", to: "audit" },
      { from: "cams", to: "rt" },
      { from: "audit", to: "rt" },
      { from: "rt", to: "ops" },
      { from: "ops", to: "911", label: "escalate" },
    ],
  },
  {
    id: "automation",
    title: "Campus automation rules",
    vertical: "Campus",
    summary:
      "Matched incident type/severity can notify roles, attach checklist, or open war room. Product hard-stops: never auto CAD write-back and never auto-lockdown from automation alone.",
    source: "campus-incident-service finalize · campus automation rules (SOC-043)",
    nodes: [
      { id: "inc", label: "Campus incident\ncreated", kind: "start" },
      { id: "rules", label: "Match automation\nrules", kind: "branch" },
      { id: "none", label: "No rule\n(ops queue only)", kind: "end" },
      { id: "notify", label: "Notify role /\nattach checklist", kind: "action" },
      { id: "war", label: "Open war room\n(optional)", kind: "parallel" },
      { id: "safe", label: "Fail-closed:\nno CAD / no auto-lockdown", kind: "end" },
    ],
    edges: [
      { from: "inc", to: "rules" },
      { from: "rules", to: "none", label: "no match" },
      { from: "rules", to: "notify", label: "match" },
      { from: "notify", to: "war" },
      { from: "notify", to: "safe" },
      { from: "war", to: "safe" },
    ],
  },
  {
    id: "venue_guest",
    title: "Venue Guest Services path",
    vertical: "Venue",
    summary:
      "VENUE_GUEST_SERVICES is intentionally not a 911 console: every page shows the disclaimer, chrome omits ops/cameras/staff/incident tools, and help intake maps to guest_services (or other non-dispatch types).",
    source: "venue-guest-services.ts · venue-guest-services-page-frame · mapHelpType",
    nodes: [
      { id: "login", label: "Sign-in as\nVENUE_GUEST_SERVICES", kind: "start" },
      { id: "gate", label: "Role chrome gate\n(no ops nav)", kind: "action" },
      { id: "disc", label: "Disclaimer on\nevery page", kind: "parallel" },
      { id: "help", label: "Guest help /\nwayfinding tools", kind: "action" },
      { id: "type", label: "helpType →\nguest_services|other", kind: "branch" },
      { id: "gs", label: "Guest services\nqueue item", kind: "end" },
      { id: "sec", label: "Hand off to\nvenue security (human)", kind: "end" },
    ],
    edges: [
      { from: "login", to: "gate" },
      { from: "gate", to: "disc" },
      { from: "gate", to: "help" },
      { from: "help", to: "type" },
      { from: "type", to: "gs", label: "guest_services" },
      { from: "type", to: "sec", label: "safety/security" },
    ],
  },
  {
    id: "venue_qr",
    title: "Venue QR → ops incident",
    vertical: "Venue",
    summary:
      "Public QR/NFC report at a zone → createVenueQrIncident → section cameras → realtime broadcast to venue console. Anonymous and identified report types supported.",
    source: "venue-incident-service · getCamerasForSection · broadcastVenueIncidentCreated",
    nodes: [
      { id: "scan", label: "Venue QR/NFC\npublic report", kind: "start" },
      { id: "form", label: "Help type +\ndescription ± identity", kind: "action" },
      { id: "create", label: "Create venue\nincident (zone/RCLI)", kind: "action" },
      { id: "cams", label: "Cameras for\nsection/zone", kind: "parallel" },
      { id: "rt", label: "Realtime broadcast\nto venue ops", kind: "action" },
      { id: "ops", label: "Venue security /\nsupervisor console", kind: "end" },
    ],
    edges: [
      { from: "scan", to: "form" },
      { from: "form", to: "create" },
      { from: "create", to: "cams" },
      { from: "create", to: "rt" },
      { from: "cams", to: "rt" },
      { from: "rt", to: "ops" },
    ],
  },
  {
    id: "pickup",
    title: "K-12 Pickup Authorization",
    vertical: "Campus K-12",
    summary:
      "Faculty/admin maintain authorized vs restricted pickup contacts per student. K-12 only; write gated by canWritePickupAuth. Custody/unauthorized-pickup concerns still route through K-12 incident types.",
    source: "pickup-auth-client · /api/campus/{agencyId}/pickup-auth · canWritePickupAuth",
    nodes: [
      { id: "k12", label: "K-12 campus\n(institutionType)", kind: "start" },
      { id: "rbac", label: "canWritePickupAuth?\n(faculty/admin)", kind: "branch" },
      { id: "view", label: "View roster\n(authorized persons)", kind: "end" },
      { id: "put", label: "PUT pickup-auth\nstudent + persons", kind: "action" },
      { id: "store", label: "Persist agency-scoped\nrecords", kind: "end" },
      { id: "alert", label: "Unauthorized pickup\n→ K-12 custody type", kind: "parallel" },
    ],
    edges: [
      { from: "k12", to: "rbac" },
      { from: "rbac", to: "view", label: "read-only" },
      { from: "rbac", to: "put", label: "write" },
      { from: "put", to: "store" },
      { from: "alert", to: "store", label: "ops concern" },
    ],
  },
  {
    id: "asr",
    title: "Clery ASR annual report",
    vertical: "Campus · Clery",
    summary:
      "Classified Clery records across coverage years → generateAsrStatistics → draft ASR artifact + policy sections. Coordinator must review before publication; ED export CSV available.",
    source: "getAsrPreview · generateAsrArtifacts · buildEdExportCsv",
    nodes: [
      { id: "recs", label: "Classified Clery\nrecords (multi-year)", kind: "start" },
      { id: "stats", label: "generateAsrStatistics\n+ policy sections", kind: "action" },
      { id: "draft", label: "ASR#year DRAFT\nartifact + audit", kind: "action" },
      { id: "coord", label: "Coordinator review\nbefore publish", kind: "branch" },
      { id: "hold", label: "Remain draft /\nrevise policies", kind: "end" },
      { id: "pub", label: "Publish / ED CSV\nexport path", kind: "end" },
    ],
    edges: [
      { from: "recs", to: "stats" },
      { from: "stats", to: "draft" },
      { from: "draft", to: "coord" },
      { from: "coord", to: "hold", label: "revise" },
      { from: "coord", to: "pub", label: "approve" },
    ],
  },
  {
    id: "cameras",
    title: "Camera registry → incident attach",
    vertical: "Campus · Venue · Transit · Vision",
    summary:
      "Place-mapped cameras (building/zone/section/vehicle) attach on incident create. Vision path can also push rapid-vision.camera.discovered over WebSocket for live discovery during a session.",
    source: "getCamerasForBuildingFloor · getCamerasForSection · getCamerasForTransitPlace · Vision WS",
    nodes: [
      { id: "reg", label: "Camera registry\n(place mapping)", kind: "start" },
      { id: "trig", label: "Incident create /\nVision session", kind: "branch" },
      { id: "place", label: "Lookup by building\nzone · section · vehicle", kind: "action" },
      { id: "disc", label: "WS camera.discovered\n(Vision path)", kind: "parallel" },
      { id: "attach", label: "Attach cameraRefs\nto incident", kind: "action" },
      { id: "ui", label: "Ops / Vision UI\nlive cameras", kind: "end" },
    ],
    edges: [
      { from: "reg", to: "trig" },
      { from: "trig", to: "place", label: "intake" },
      { from: "trig", to: "disc", label: "vision" },
      { from: "place", to: "attach" },
      { from: "disc", to: "ui" },
      { from: "attach", to: "ui" },
    ],
  },
];

