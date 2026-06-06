import type { ProtocolPack } from "./types.js";

/** Default English packs — replace or extend per agency via future agency-specific loaders. */
export const DEFAULT_PROTOCOL_PACKS: ProtocolPack[] = [
  {
    id: "default.cpr_cardiac_v1",
    name: "CPR / suspected cardiac arrest (pre-arrival coach)",
    category: "cpr_cardiac_arrest",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: [
      "not breathing",
      "cardiac arrest",
      "cpr",
      "collapsed",
      "no pulse",
      "unconscious",
      "turning blue",
      "gasping",
    ],
    protocolEscalationSummary:
      "Escalate immediately if breathing is absent or only agonal gasps, if CPR is in progress with fatigue, or if scene becomes unsafe.",
    steps: [
      {
        id: "assess_responsiveness_breathing",
        order: 1,
        title: "Check responsiveness and breathing",
        dispatcherPhrase:
          "I'm here with you. Tell me if he is breathing normally in the last few seconds.",
        rationale:
          "This protocol starts with breathing status — it drives every next safe action.",
        escalationCriteria:
          "If not breathing or only gasping, continue this protocol and request an AED if available.",
        advanceWhen: ["breathing", "not breathing", "gasping", "no", "yes"],
      },
      {
        id: "cpr_coach_start",
        order: 2,
        title: "Coach compressions",
        dispatcherPhrase:
          "Stay on the line with me. Push hard and fast in the center of the chest — I’ll count with you when you’re ready.",
        rationale:
          "Compressions are the priority when breathing is absent; keep coaching calm and steady.",
        escalationCriteria:
          "If the caller cannot continue, arrange relay CPR or alternate compressors; escalate medical priority.",
        advanceWhen: ["compressions", "cpr", "pushing", "doing cpr"],
      },
      {
        id: "aed_on_the_way",
        order: 3,
        title: "AED readiness",
        dispatcherPhrase:
          "If there is an AED nearby, bring it to him now — do not delay compressions to look for long.",
        rationale:
          "Early defibrillation when indicated saves lives; wording keeps focus without inventing device steps.",
        escalationCriteria:
          "If AED advises shock, ensure everyone is clear before shock; resume compressions after as trained.",
        advanceWhen: ["aed", "defib", "shock"],
      },
    ],
  },
  {
    id: "default.aed_v1",
    name: "AED use (coach, scene-safe)",
    category: "aed_use",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["aed", "defib", "defibrillator", "shock", "pads"],
    protocolEscalationSummary:
      "Escalate if the scene is unsafe, if the patient wakes and then collapses again, or if the AED repeats shock advice with no recovery.",
    steps: [
      {
        id: "aed_place_power",
        order: 1,
        title: "Place and power AED",
        dispatcherPhrase:
          "Stay on the line. Put the AED where you can reach it and turn it on — listen to the voice prompts.",
        rationale:
          "AED voice prompts are authoritative; the dispatcher keeps the caller calm and clear of hazards.",
        escalationCriteria:
          "If anyone is touching the patient during analysis or shock, stop and clear the patient.",
        advanceWhen: ["turned on", "on", "pads"],
      },
      {
        id: "clear_during_analysis",
        order: 2,
        title: "Clear during analysis",
        dispatcherPhrase:
          "Do not touch him while the device checks. Everyone step back until it says it is safe.",
        rationale:
          "Motion can confuse rhythm analysis; this line reinforces scene safety without adding device-specific claims.",
        escalationCriteria:
          "If shock is advised, confirm a clear patient before the shock as the AED instructs.",
        advanceWhen: ["clear", "analyzing", "shock"],
      },
    ],
  },
  {
    id: "default.choking_v1",
    name: "Severe airway obstruction (choking)",
    category: "choking",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["choking", "can't breathe", "cannot breathe", "turning blue", "food stuck"],
    protocolEscalationSummary:
      "Escalate if the person becomes unresponsive, if efforts fail, or if the caller cannot follow instructions.",
    steps: [
      {
        id: "encourage_cough_first",
        order: 1,
        title: "Encourage effective cough if possible",
        dispatcherPhrase:
          "If they can cough, encourage strong coughs. I’m right here — tell me if the cough stops working.",
        rationale:
          "A strong cough can clear a partial obstruction; we stay with emotional support without inventing Heimlich steps.",
        escalationCriteria:
          "If cough is silent or ineffective, follow your agency choking procedure for conscious adults/children/infants.",
        advanceWhen: ["can't cough", "not coughing", "silent", "worse"],
      },
      {
        id: "stay_on_line_help_coming",
        order: 2,
        title: "Keep line open",
        dispatcherPhrase:
          "Help is on the way. Stay on the line and tell me the moment anything changes.",
        rationale:
          "Maintains contact while agency-specific maneuvers are applied by trained dispatchers.",
        escalationCriteria:
          "If the person becomes unconscious, switch to unconscious-person protocol per agency policy.",
        advanceWhen: ["unconscious", "passed out", "not awake"],
      },
    ],
  },
  {
    id: "default.bleeding_v1",
    name: "Severe bleeding (scene-safe coach)",
    category: "severe_bleeding",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["bleeding", "blood", "hemorrhage", "arterial", "won't stop bleeding"],
    protocolEscalationSummary:
      "Escalate for uncontrolled bleeding, altered mental status, or unsafe scene.",
    steps: [
      {
        id: "direct_pressure",
        order: 1,
        title: "Firm pressure",
        dispatcherPhrase:
          "If it is safe to reach, apply firm, steady pressure with a clean cloth — keep it simple and steady.",
        rationale:
          "Direct pressure is widely taught; we avoid improvised tourniquet language unless your pack adds it.",
        escalationCriteria:
          "Escalate if bleeding does not slow, if the caller cannot safely reach, or if multiple injuries.",
        advanceWhen: ["pressure", "holding", "cloth"],
      },
    ],
  },
  {
    id: "default.stroke_v1",
    name: "Suspected stroke (time-sensitive)",
    category: "stroke",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["stroke", "facial droop", "slurred", "weak on one side", "sudden confusion"],
    protocolEscalationSummary:
      "Escalate as time-critical neurology; prioritize accurate symptom timing and safe transport options.",
    steps: [
      {
        id: "last_known_well",
        order: 1,
        title: "Time last known normal",
        dispatcherPhrase:
          "When was the last time they seemed completely normal to you? Even a rough time helps.",
        rationale:
          "Last known well guides hospital pathways; we do not diagnose stroke on the phone.",
        escalationCriteria:
          "Escalate if symptoms are sudden, severe, or worsening while you stay on the line.",
        advanceWhen: ["minutes", "hours", "this morning", "yesterday"],
      },
    ],
  },
  {
    id: "default.unconscious_v1",
    name: "Unconscious person (general)",
    category: "unconscious_person",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["unconscious", "won't wake", "not responsive", "passed out", "limp"],
    protocolEscalationSummary:
      "Escalate if breathing is absent or uncertain, if scene is unsafe, or if condition changes suddenly.",
    steps: [
      {
        id: "breathing_simple",
        order: 1,
        title: "Breathing check",
        dispatcherPhrase:
          "I’m here with you. Tell me if you feel or hear normal breathing right now.",
        rationale:
          "Breathing status is the fork for airway and CPR pathways without inventing medical exams.",
        escalationCriteria:
          "If not breathing or only gasping, move toward CPR/AED support per agency policy.",
        advanceWhen: ["breathing", "not breathing", "gasping"],
      },
    ],
  },
  {
    id: "default.fire_evac_v1",
    name: "Structure fire — evacuation coach",
    category: "fire_evacuation",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["fire", "smoke", "flames", "evacuate", "burning house"],
    protocolEscalationSummary:
      "Escalate for trapped persons, growing fire, or caller in immediate danger.",
    steps: [
      {
        id: "safe_exit",
        order: 1,
        title: "Safe exit first",
        dispatcherPhrase:
          "If you can leave safely, get out now and close doors behind you if you can without slowing down.",
        rationale:
          "Evacuation wording stays general; tactical fire instructions belong to your agency fire protocol.",
        escalationCriteria:
          "Escalate if anyone is trapped, if smoke is heavy in hallways, or if exit is blocked.",
        advanceWhen: ["outside", "out", "evacuated"],
      },
    ],
  },
  {
    id: "default.domestic_silent_v1",
    name: "Domestic disturbance / open or silent line",
    category: "domestic_disturbance_silent_caller",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: ["domestic", "yelling", "neighbor", "silent", "open line", "can't talk"],
    protocolEscalationSummary:
      "Escalate for weapons mentioned, sounds of violence, threats, or confirmed injury.",
    steps: [
      {
        id: "yes_no_signals",
        order: 1,
        title: "Voice or tap signals",
        dispatcherPhrase:
          "If you can’t speak freely, tap once for yes and twice for no — I’ll stay with you.",
        rationale:
          "Preserves safety on sensitive lines without inventing law-enforcement tactics.",
        escalationCriteria:
          "Escalate if weapons are mentioned, if injury is reported, or if the line goes silent unexpectedly.",
        advanceWhen: ["tap", "yes", "no", "help"],
      },
    ],
  },
  {
    id: "default.welfare_check_v1",
    name: "Welfare check — access and safety",
    category: "welfare_check",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: [
      "welfare check",
      "wellness check",
      "check on",
      "hasn't answered",
      "not answering",
      "elderly",
      "worried about",
    ],
    protocolEscalationSummary:
      "Escalate if forced entry is mentioned, if weapons or threats appear, or if the caller cannot verify safety.",
    steps: [
      {
        id: "verify_reason_location",
        order: 1,
        title: "Reason and last contact",
        dispatcherPhrase:
          "Tell me what worries you and the last time someone had contact with them — even rough is fine.",
        rationale:
          "Establishes baseline without directing entry or medical conclusions; agency policy governs entry.",
        escalationCriteria:
          "Escalate if caller reports sounds of distress, weapons, or immediate danger at the location.",
        advanceWhen: ["yesterday", "today", "hours", "days", "door", "window"],
      },
      {
        id: "stay_clear_safe_position",
        order: 2,
        title: "Caller safety",
        dispatcherPhrase:
          "Stay in a safe place where you can keep updating me if anything changes.",
        rationale:
          "Keeps the caller out of harm’s way while units respond; no solo-entry coaching.",
        escalationCriteria:
          "If caller intends to enter alone, reinforce waiting for responders per agency policy.",
        advanceWhen: ["outside", "car", "neighbor", "waiting"],
      },
    ],
  },
  {
    id: "default.unknown_stress_v1",
    name: "High-stress / unclear facts — calm clarification",
    category: "unknown_high_stress",
    locale: "en",
    version: "1.0.0",
    identificationKeywords: [
      "i don't know",
      "please hurry",
      "screaming",
      "panic",
      "help help",
      "something wrong",
      "not sure",
    ],
    protocolEscalationSummary:
      "Escalate if facts emerge that indicate medical, fire, or law-enforcement priority; keep line open.",
    steps: [
      {
        id: "one_fact_at_a_time",
        order: 1,
        title: "Single clarifying question",
        dispatcherPhrase:
          "I’m with you. In one short sentence, what is happening right in front of you right now?",
        rationale:
          "Reduces overload; avoids inventing scene details the caller has not stated.",
        escalationCriteria:
          "If breathing, fire, violence, or weapons become clear, switch to the matching protocol pack.",
        advanceWhen: ["fire", "blood", "not breathing", "gun", "fight", "hurt"],
      },
      {
        id: "affirm_help_enroute_or_pending",
        order: 2,
        title: "Affirm help",
        dispatcherPhrase:
          "Stay on the line — help is being coordinated. Tell me the moment anything changes.",
        rationale:
          "Stabilizes tone without promising timelines you cannot verify from this channel.",
        escalationCriteria:
          "Escalate internally if the line drops or audio suggests immediate danger.",
        advanceWhen: ["okay", "hurry", "still here"],
      },
    ],
  },
];
