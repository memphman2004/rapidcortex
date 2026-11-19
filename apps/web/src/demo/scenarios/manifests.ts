import { CARDIAC_ASSIST_HIGHLIGHT, GUIDED_TOUR_CALLOUTS } from "../fixtures/callouts";
import { locationLabel } from "../fixtures/locations";
import { createStartingState, fictionalPhone } from "../fixtures/state";
import { availableUnits } from "../fixtures/units";
import type {
  DemoCall,
  DemoEvent,
  DemoEventPayload,
  DemoEventType,
  DemoIncident,
  DemoScenarioManifest,
  DemoUnit,
} from "../types";

function payload(values: DemoEventPayload): DemoEventPayload {
  return values;
}

function event(
  id: string,
  offset: number,
  type: DemoEventType,
  summary: string,
  body: DemoEventPayload,
  highlightId?: string,
): DemoEvent {
  return {
    id,
    relativeOffsetSeconds: offset,
    type,
    summary,
    payload: payload(body),
    highlightId,
  };
}

function call(partial: DemoCall): DemoCall {
  return partial;
}

type IncidentDefaults = "continuity" | "transcript" | "commandNotes" | "major" | "mci" | "units";
type IncidentInput = Omit<DemoIncident, IncidentDefaults> & Partial<Pick<DemoIncident, IncidentDefaults>>;

function incident(partial: IncidentInput): DemoIncident {
  return {
    ...partial,
    continuity: partial.continuity ?? [],
    transcript: partial.transcript ?? [],
    commandNotes: partial.commandNotes ?? [],
    major: partial.major ?? false,
    mci: partial.mci ?? false,
    units: partial.units ?? [],
  };
}

const chestPain = "inc-chest-pain";
const noise = "inc-noise";
const spanishMvc = "inc-spanish-mvc";
const welfare = "inc-welfare";
const slip = "inc-slip";
const bar = "inc-bar";
const unconscious = "inc-unconscious";
const brush = "inc-brush";
const propertyDamage = "inc-property";
const repeatMedical = "inc-repeat";
const mci = "inc-mci";
const structure = "inc-structure";
const breathing = "inc-breathing";
const alarm = "inc-alarm";

function holdingCall(id: string, summary: string, locationId: string, discipline: DemoCall["discipline"]): DemoCall {
  return call({
    id,
    discipline,
    priority: discipline === "admin" ? "non-emergency" : "emergency",
    summary,
    locationId,
    language: "en",
    status: "queued",
    repeatCaller: false,
    phone: fictionalPhone(id.slice(-3).padStart(3, "0")),
  });
}

export function buildStandardScenario(): DemoScenarioManifest {
  const startingState = createStartingState({
    onShiftIds: ["D-01", "D-02", "D-03", "D-05"],
    clockLabel: "09:40",
    recentActivity: ["Shift change complete. Four positions open. Casey Vance is the floor supervisor."],
  });

  return {
    id: "demo-standard",
    displayName: "Standard Operations",
    description:
      "A representative mid-morning shift at Maplewood County Communications Center. Steady call volume across law, fire, and EMS.",
    audience: "Everyday product demo",
    featureHighlights: [
      "Pre-arrival context on a cardiac call",
      "Call Assist suggestion during the live call",
      "Live transcription",
      "Spanish-language translation",
      "Continuity Log",
      "Supervisor view across positions",
      "Unit status from dispatch through available",
    ],
    estimatedDurationSeconds: 240,
    manualAdvance: false,
    enabled: true,
    startingState,
    guidedHighlights: [CARDIAC_ASSIST_HIGHLIGHT],
    events: [
      event("std-01", 12, "CALL_RECEIVED", "Medical, chest pain, 2847 Ridgemont Blvd", {
        call: call({
          id: "call-chest",
          discipline: "ems",
          priority: "emergency",
          summary: "Elderly male, crushing chest pain",
          locationId: "loc-ridgemont-blvd",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("201"),
        }),
      }),
      event("std-02", 18, "CALL_ANSWERED", "Alex Carver answered the chest-pain call", {
        callId: "call-chest",
        positionId: "D-01",
      }),
      event(
        "std-03",
        24,
        "CALL_ASSIST_SUGGESTION",
        "Cardiac protocol surfaced",
        {
          callId: "call-chest",
          text: "Possible acute coronary syndrome. Ask about breathing, aspirin, and prior heart history. Prepare ALS.",
        },
        "hl-cardiac-assist",
      ),
      event("std-04", 30, "INCIDENT_CREATED", "Incident opened — chest pain, Ridgemont Blvd", {
        incident: incident({
          id: chestPain,
          callId: "call-chest",
          title: "Chest pain — elderly male",
          discipline: "ems",
          locationId: "loc-ridgemont-blvd",
          status: "active",
          openedAtSeconds: 30,
        }),
      }),
      event("std-05", 36, "UNIT_DISPATCHED", "MED-2 dispatched to Ridgemont Blvd", {
        unitId: "MED-2",
        incidentId: chestPain,
        callId: "call-chest",
      }),
      event("std-06", 44, "TRANSCRIPTION_UPDATE", "\"sir, can you tell me if he's breathing...\"", {
        incidentId: chestPain,
        speaker: "dispatcher",
        text: "Sir, can you tell me if he's breathing and if he is awake?",
      }),
      event("std-07", 52, "TRANSCRIPTION_UPDATE", "Caller: he is sweaty and his left arm hurts", {
        incidentId: chestPain,
        speaker: "caller",
        text: "He is sweaty and says his left arm hurts. He is talking to me.",
      }),
      event("std-08", 60, "UNIT_STATUS_CHANGED", "MED-2 en route", {
        unitId: "MED-2",
        incidentId: chestPain,
        status: "en_route",
      }),
      event("std-09", 70, "CALL_RECEIVED", "Law enforcement, noise complaint, Willow Creek Court", {
        call: call({
          id: "call-noise",
          discipline: "law",
          priority: "non-emergency",
          summary: "Loud music, no threats",
          locationId: "loc-willow-creek",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("202"),
        }),
      }),
      event("std-10", 76, "CALL_ANSWERED", "Morgan Reyes answered the noise complaint", {
        callId: "call-noise",
        positionId: "D-02",
      }),
      event("std-11", 82, "INCIDENT_CREATED", "Incident opened — noise complaint", {
        incident: incident({
          id: noise,
          callId: "call-noise",
          title: "Noise complaint",
          discipline: "law",
          locationId: "loc-willow-creek",
          status: "active",
          openedAtSeconds: 82,
        }),
      }),
      event("std-12", 88, "UNIT_DISPATCHED", "MC-14 dispatched to Willow Creek Court", {
        unitId: "MC-14",
        incidentId: noise,
        callId: "call-noise",
      }),
      event("std-13", 98, "CALL_RECEIVED", "Spanish-language caller — vehicle accident with injuries", {
        call: call({
          id: "call-mvc",
          discipline: "ems",
          priority: "emergency",
          summary: "Vehicle accident with injuries",
          locationId: "loc-clearfield-orchard",
          language: "es",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("203"),
        }),
      }),
      event("std-14", 104, "TRANSLATION_DETECTED", "Spanish detected — translation layer on", {
        callId: "call-mvc",
        incidentId: spanishMvc,
        language: "es",
        note: "Caller is speaking Spanish. Live translation is on for Jordan Hale. No third-party language line.",
      }),
      event("std-15", 108, "CALL_ANSWERED", "Jordan Hale answered with translation on", {
        callId: "call-mvc",
        positionId: "D-03",
      }),
      event("std-16", 114, "INCIDENT_CREATED", "Incident opened — injury accident, Clearfield Rd & Orchard Lane", {
        incident: incident({
          id: spanishMvc,
          callId: "call-mvc",
          title: "Injury accident — Spanish-speaking caller",
          discipline: "ems",
          locationId: "loc-clearfield-orchard",
          status: "active",
          openedAtSeconds: 114,
          translation: {
            language: "es",
            note: "Two vehicles, one person crying, caller says someone is hurt in the second car.",
          },
        }),
      }),
      event("std-17", 120, "UNIT_DISPATCHED", "MED-6 dispatched to the accident", {
        unitId: "MED-6",
        incidentId: spanishMvc,
        callId: "call-mvc",
      }),
      event("std-18", 124, "UNIT_DISPATCHED", "ENG-4 dispatched to the accident", {
        unitId: "ENG-4",
        incidentId: spanishMvc,
        callId: "call-mvc",
      }),
      event("std-19", 132, "TRANSCRIPTION_UPDATE", "Translated: a person is pinned and bleeding", {
        incidentId: spanishMvc,
        speaker: "caller",
        text: "Hay una persona atrapada y está sangrando. Por favor apúrense.",
      }),
      event("std-20", 140, "CALL_RECEIVED", "Welfare check, 220 Cedar Post Road", {
        call: call({
          id: "call-welfare",
          discipline: "law",
          priority: "emergency",
          summary: "Elderly parent not answering",
          locationId: "loc-cedar-post",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("204"),
        }),
      }),
      event("std-21", 146, "INCIDENT_CREATED", "Incident opened — welfare check", {
        incident: incident({
          id: welfare,
          callId: "call-welfare",
          title: "Welfare check",
          discipline: "law",
          locationId: "loc-cedar-post",
          status: "active",
          openedAtSeconds: 146,
        }),
      }),
      event("std-22", 150, "CALL_ANSWERED", "Morgan Reyes answered the welfare check", {
        callId: "call-welfare",
        positionId: "D-02",
      }),
      event("std-23", 156, "UNIT_DISPATCHED", "RPD-3 dispatched to Cedar Post Road", {
        unitId: "RPD-3",
        incidentId: welfare,
        callId: "call-welfare",
      }),
      event("std-24", 168, "UNIT_STATUS_CHANGED", "MED-2 on scene at Ridgemont Blvd", {
        unitId: "MED-2",
        incidentId: chestPain,
        status: "on_scene",
      }),
      event("std-25", 172, "CONTINUITY_LOG_UPDATED", "Continuity Log — MED-2 on scene, patient conscious", {
        incidentId: chestPain,
        entry: "MED-2 on scene. Patient conscious, diaphoretic, cardiac protocol in use.",
      }),
      event("std-26", 180, "CALL_RECEIVED", "Slip and fall, 15 Market Square", {
        call: call({
          id: "call-slip",
          discipline: "ems",
          priority: "emergency",
          summary: "Slip and fall, commercial property",
          locationId: "loc-market-square",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("205"),
        }),
      }),
      event("std-27", 186, "INCIDENT_CREATED", "Incident opened — slip and fall", {
        incident: incident({
          id: slip,
          callId: "call-slip",
          title: "Slip and fall",
          discipline: "ems",
          locationId: "loc-market-square",
          status: "active",
          openedAtSeconds: 186,
        }),
      }),
      event("std-28", 190, "UNIT_DISPATCHED", "MED-11 dispatched to Market Square", {
        unitId: "MED-11",
        incidentId: slip,
        callId: "call-slip",
      }),
      event("std-29", 198, "UNIT_STATUS_CHANGED", "MC-14 cleared the noise complaint", {
        unitId: "MC-14",
        incidentId: noise,
        status: "available",
      }),
      event("std-30", 200, "INCIDENT_CLOSED", "Noise complaint closed", {
        incidentId: noise,
        summary: "Music turned down. No crime. MC-14 available.",
      }),
      event("std-31", 208, "INCIDENT_UPDATED", "Accident escalated — additional units requested", {
        incidentId: spanishMvc,
        patch: { title: "Injury accident — extrication", status: "active" },
      }),
      event("std-32", 212, "UNIT_DISPATCHED", "RPD-9 dispatched to the accident", {
        unitId: "RPD-9",
        incidentId: spanishMvc,
        callId: "call-mvc",
      }),
      event("std-33", 216, "UNIT_DISPATCHED", "ENG-7 added for extrication", {
        unitId: "ENG-7",
        incidentId: spanishMvc,
        callId: "call-mvc",
      }),
      event("std-34", 228, "UNIT_STATUS_CHANGED", "MED-2 transporting to Maplewood Regional", {
        unitId: "MED-2",
        incidentId: chestPain,
        status: "transporting",
      }),
      event("std-35", 236, "CONTINUITY_LOG_UPDATED", "Continuity Log — transport to Maplewood Regional", {
        incidentId: chestPain,
        entry: "MED-2 transporting to Maplewood Regional Medical Center, 500 Hospital Drive.",
      }),
      event("std-36", 250, "UNIT_STATUS_CHANGED", "MED-2 available", {
        unitId: "MED-2",
        incidentId: chestPain,
        status: "available",
      }),
      event("std-37", 252, "INCIDENT_CLOSED", "Chest-pain incident closed", {
        incidentId: chestPain,
        summary: "Patient delivered to Maplewood Regional. MED-2 available.",
      }),
      event("std-38", 258, "UNIT_STATUS_CHANGED", "RPD-3 available", {
        unitId: "RPD-3",
        incidentId: welfare,
        status: "available",
      }),
      event("std-39", 260, "INCIDENT_CLOSED", "Welfare check closed — resident is safe", {
        incidentId: welfare,
        summary: "Resident found safe. RPD-3 available.",
      }),
      event("std-40", 266, "UNIT_STATUS_CHANGED", "MED-6 available", {
        unitId: "MED-6",
        incidentId: spanishMvc,
        status: "available",
      }),
      event("std-41", 268, "UNIT_STATUS_CHANGED", "ENG-4 available", {
        unitId: "ENG-4",
        incidentId: spanishMvc,
        status: "available",
      }),
      event("std-42", 270, "UNIT_STATUS_CHANGED", "RPD-9 available", {
        unitId: "RPD-9",
        incidentId: spanishMvc,
        status: "available",
      }),
      event("std-43", 272, "UNIT_STATUS_CHANGED", "ENG-7 available", {
        unitId: "ENG-7",
        incidentId: spanishMvc,
        status: "available",
      }),
      event("std-44", 274, "UNIT_STATUS_CHANGED", "MED-11 available", {
        unitId: "MED-11",
        incidentId: slip,
        status: "available",
      }),
      event("std-45", 276, "INCIDENT_CLOSED", "Accident and slip-and-fall closed", {
        incidentId: spanishMvc,
        summary: "Patients treated. Extrication complete. Units available.",
      }),
      event("std-46", 278, "INCIDENT_CLOSED", "Slip and fall closed", {
        incidentId: slip,
        summary: "Patient refused transport. MED-11 available.",
      }),
      event("std-47", 282, "ADMIN_CALL_ROUTED", "Administrative call held — records request", {
        call: call({
          id: "call-admin-1",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Records request, callback only",
          locationId: "loc-regional-medical",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("301"),
        }),
        disposition: "Queued for the administrative line. No field unit.",
      }),
      event("std-48", 286, "ADMIN_CALL_ROUTED", "Administrative call held — directions to the center", {
        call: call({
          id: "call-admin-2",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Caller asking how to reach the communications center",
          locationId: "loc-high-school",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("302"),
        }),
        disposition: "Queued for the administrative line. No field unit.",
      }),
    ],
  };
}

export function buildHighVolumeScenario(): DemoScenarioManifest {
  const startingState = createStartingState({
    onShiftIds: ["D-01", "D-02", "D-03", "D-04", "D-05"],
    clockLabel: "22:15",
    callsLast30Minutes: 11,
    callQueue: [
      holdingCall("q1", "Parking complaint, Ridgemont Plaza", "loc-plaza-lot", "law"),
      holdingCall("q2", "Lift assist, Willow Creek Court", "loc-willow-creek", "ems"),
      holdingCall("q3", "Barking dog, Cedar Post Road", "loc-cedar-post", "admin"),
    ],
    recentActivity: ["Friday night. All four positions staffed. Three calls already holding."],
  });

  return {
    id: "demo-high-volume",
    displayName: "High-Volume Night",
    description:
      "Friday night at Maplewood County Communications. Queue depth is climbing and every dispatcher position is busy.",
    audience: "Shows why Call Assist matters under load",
    featureHighlights: [
      "Queue depth rising",
      "Call Assist on routine calls",
      "Several incidents at once",
      "Position load on the supervisor board",
      "Administrative call routed off the emergency line",
      "Priority call interrupting the non-emergency queue",
      "Repeat-caller location flag",
    ],
    estimatedDurationSeconds: 280,
    manualAdvance: false,
    enabled: true,
    startingState,
    events: [
      event("hv-01", 8, "QUEUE_DEPTH_CHANGED", "Queue opens with three calls holding", { depth: 3 }),
      event("hv-02", 16, "CALL_RECEIVED", "Law enforcement — disturbance at 900 Lantern Street", {
        call: call({
          id: "call-bar",
          discipline: "law",
          priority: "emergency",
          summary: "Bar disturbance, crowd in the street",
          locationId: "loc-lantern-bar",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("401"),
        }),
      }),
      event("hv-03", 22, "INCIDENT_CREATED", "Incident opened — Lantern Street disturbance", {
        incident: incident({
          id: bar,
          callId: "call-bar",
          title: "Bar disturbance",
          discipline: "law",
          locationId: "loc-lantern-bar",
          status: "active",
          openedAtSeconds: 22,
        }),
      }),
      event("hv-04", 28, "UNIT_DISPATCHED", "RPD-3 dispatched to Lantern Street", {
        unitId: "RPD-3",
        incidentId: bar,
        callId: "call-bar",
      }),
      event("hv-05", 32, "UNIT_DISPATCHED", "RPD-9 dispatched to Lantern Street", {
        unitId: "RPD-9",
        incidentId: bar,
        callId: "call-bar",
      }),
      event("hv-06", 40, "CALL_RECEIVED", "Medical — unconscious person, Ridgemont Plaza lot. Priority.", {
        call: call({
          id: "call-unconscious",
          discipline: "ems",
          priority: "emergency",
          summary: "Unconscious person in the parking lot",
          locationId: "loc-plaza-lot",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("402"),
        }),
        priorityFlag: true,
      }),
      event("hv-07", 46, "INCIDENT_CREATED", "Priority incident — unconscious person", {
        incident: incident({
          id: unconscious,
          callId: "call-unconscious",
          title: "Unconscious person — priority",
          discipline: "ems",
          locationId: "loc-plaza-lot",
          status: "active",
          major: true,
          openedAtSeconds: 46,
        }),
      }),
      event("hv-08", 50, "CALL_ASSIST_SUGGESTION", "Call Assist — check breathing and start CPR instructions if needed", {
        incidentId: unconscious,
        text: "Unresponsive patient. Ask if they are breathing normally. If not, give compressions instructions and send ALS.",
      }),
      event("hv-09", 54, "UNIT_DISPATCHED", "MED-2 dispatched priority to the plaza lot", {
        unitId: "MED-2",
        incidentId: unconscious,
        callId: "call-unconscious",
      }),
      event("hv-10", 62, "CALL_RECEIVED", "Fire — outdoor brush fire, County Road 12", {
        call: call({
          id: "call-brush",
          discipline: "fire",
          priority: "emergency",
          summary: "Brush fire near the tree line",
          locationId: "loc-brush-hollow",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("403"),
        }),
      }),
      event("hv-11", 68, "INCIDENT_CREATED", "Incident opened — brush fire", {
        incident: incident({
          id: brush,
          callId: "call-brush",
          title: "Outdoor brush fire",
          discipline: "fire",
          locationId: "loc-brush-hollow",
          status: "active",
          openedAtSeconds: 68,
        }),
      }),
      event("hv-12", 72, "UNIT_DISPATCHED", "ENG-4 dispatched to Brush Hollow", {
        unitId: "ENG-4",
        incidentId: brush,
        callId: "call-brush",
      }),
      event("hv-13", 80, "CALL_RECEIVED", "Law enforcement — vehicle accident, no injuries", {
        call: call({
          id: "call-pdo",
          discipline: "law",
          priority: "non-emergency",
          summary: "Two-car accident, no injuries reported",
          locationId: "loc-clearfield-orchard",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("404"),
        }),
      }),
      event("hv-14", 86, "INCIDENT_CREATED", "Incident opened — property-damage accident", {
        incident: incident({
          id: propertyDamage,
          callId: "call-pdo",
          title: "Accident, no injuries",
          discipline: "law",
          locationId: "loc-clearfield-orchard",
          status: "active",
          openedAtSeconds: 86,
        }),
      }),
      event("hv-15", 90, "UNIT_DISPATCHED", "MC-07 dispatched to the accident", {
        unitId: "MC-07",
        incidentId: propertyDamage,
        callId: "call-pdo",
      }),
      event("hv-16", 98, "ADMIN_CALL_ROUTED", "Non-emergency line routed automatically — lost dog", {
        call: call({
          id: "call-dog",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Lost dog, caller wants animal control hours",
          locationId: "loc-willow-creek",
          language: "en",
          status: "handled",
          repeatCaller: false,
          phone: fictionalPhone("405"),
        }),
        disposition: "Call Assist answered. Animal-control hours given. No dispatcher required.",
      }),
      event("hv-17", 110, "CALL_RECEIVED", "Medical — same plaza lot as a call 48 hours ago", {
        call: call({
          id: "call-repeat",
          discipline: "ems",
          priority: "emergency",
          summary: "Person down, same stall as a prior call",
          locationId: "loc-plaza-lot",
          language: "en",
          status: "queued",
          repeatCaller: true,
          phone: fictionalPhone("406"),
        }),
      }),
      event("hv-18", 114, "REPEAT_CALLER_FLAGGED", "Repeat location — Ridgemont Plaza lot, call handled 48 hours ago", {
        callId: "call-repeat",
        locationId: "loc-plaza-lot",
        note: "This lot had a medical call 48 hours ago. Flag is visible to the calltaker and the supervisor.",
      }),
      event("hv-19", 120, "INCIDENT_CREATED", "Incident opened — repeat location medical", {
        incident: incident({
          id: repeatMedical,
          callId: "call-repeat",
          title: "Medical — repeat location",
          discipline: "ems",
          locationId: "loc-plaza-lot",
          status: "active",
          openedAtSeconds: 120,
        }),
      }),
      event("hv-20", 126, "UNIT_DISPATCHED", "MED-6 dispatched to the repeat-location call", {
        unitId: "MED-6",
        incidentId: repeatMedical,
        callId: "call-repeat",
      }),
      event("hv-21", 136, "QUEUE_DEPTH_CHANGED", "Queue reaches five calls holding", { depth: 5 }),
      event("hv-22", 140, "SUPERVISOR_ALERT", "Supervisor alert — five calls holding", {
        message: "Queue depth is 5. Casey Vance has a load alert across all four positions.",
      }),
      event("hv-23", 150, "INCIDENT_UPDATED", "Lantern Street disturbance escalated", {
        incidentId: bar,
        patch: { title: "Bar disturbance — crowd growing" },
      }),
      event("hv-24", 156, "UNIT_DISPATCHED", "ENG-7 added for standby at Lantern Street", {
        unitId: "ENG-7",
        incidentId: bar,
        callId: "call-bar",
      }),
      event("hv-25", 168, "UNIT_STATUS_CHANGED", "MED-2 on scene with the unconscious patient", {
        unitId: "MED-2",
        incidentId: unconscious,
        status: "on_scene",
      }),
      event("hv-26", 176, "MUTUAL_AID_REQUESTED", "AIR-1 requested for the unconscious patient", {
        resource: "AIR-1",
        incidentId: unconscious,
        note: "ALS on scene requests air medical. Mutual-aid surface is up for Casey Vance.",
      }),
      event("hv-27", 182, "UNIT_DISPATCHED", "AIR-1 launched", {
        unitId: "AIR-1",
        incidentId: unconscious,
        callId: "call-unconscious",
      }),
      event("hv-28", 200, "QUEUE_DEPTH_CHANGED", "Queue beginning to clear", { depth: 2 }),
      event("hv-29", 220, "UNIT_STATUS_CHANGED", "RPD-3 available", {
        unitId: "RPD-3",
        incidentId: bar,
        status: "available",
      }),
      event("hv-30", 224, "UNIT_STATUS_CHANGED", "RPD-9 available", {
        unitId: "RPD-9",
        incidentId: bar,
        status: "available",
      }),
      event("hv-31", 228, "UNIT_STATUS_CHANGED", "ENG-7 available", {
        unitId: "ENG-7",
        incidentId: bar,
        status: "available",
      }),
      event("hv-32", 232, "INCIDENT_CLOSED", "Lantern Street disturbance closed", {
        incidentId: bar,
        summary: "Crowd dispersed. Units available.",
      }),
      event("hv-33", 240, "UNIT_STATUS_CHANGED", "ENG-4 available", {
        unitId: "ENG-4",
        incidentId: brush,
        status: "available",
      }),
      event("hv-34", 242, "INCIDENT_CLOSED", "Brush fire contained", {
        incidentId: brush,
        summary: "Fire out. ENG-4 available.",
      }),
      event("hv-35", 248, "UNIT_STATUS_CHANGED", "MC-07 available", {
        unitId: "MC-07",
        incidentId: propertyDamage,
        status: "available",
      }),
      event("hv-36", 250, "INCIDENT_CLOSED", "Property-damage accident closed", {
        incidentId: propertyDamage,
        summary: "Exchange of information only. MC-07 available.",
      }),
      event("hv-37", 258, "UNIT_STATUS_CHANGED", "MED-2 available", {
        unitId: "MED-2",
        incidentId: unconscious,
        status: "available",
      }),
      event("hv-38", 260, "UNIT_STATUS_CHANGED", "AIR-1 available", {
        unitId: "AIR-1",
        incidentId: unconscious,
        status: "available",
      }),
      event("hv-39", 262, "INCIDENT_CLOSED", "Unconscious patient transported by air", {
        incidentId: unconscious,
        summary: "Patient flown to Maplewood Regional. MED-2 and AIR-1 available.",
      }),
      event("hv-40", 268, "UNIT_STATUS_CHANGED", "MED-6 available", {
        unitId: "MED-6",
        incidentId: repeatMedical,
        status: "available",
      }),
      event("hv-41", 270, "INCIDENT_CLOSED", "Repeat-location medical closed", {
        incidentId: repeatMedical,
        summary: "Patient evaluated and transported by MED-6. Unit available.",
      }),
      event("hv-42", 276, "QUEUE_DEPTH_CHANGED", "Queue cleared", { depth: 0 }),
      event("hv-43", 280, "SUPERVISOR_ALERT", "Shift snapshot — calls answered, handle time, unit use", {
        message:
          "Friday snapshot: 14 emergency calls this hour, mean handle 86 seconds on routine law calls with Call Assist, all units cycling back to available.",
        shiftSummary:
          "Calls answered this hour: 14. Routine law handle time with Call Assist: 86 seconds. Units utilized: 7 of 10, now clearing.",
      }),
    ],
  };
}

export function buildMciScenario(): DemoScenarioManifest {
  return {
    id: "demo-mci",
    displayName: "Mass Casualty Response",
    description:
      "A multi-vehicle accident on Interstate 47 with a concurrent structure fire. Every discipline is committed.",
    audience: "Supervisor and command audiences",
    featureHighlights: [
      "Major-incident flag",
      "Several incidents on one board",
      "Coverage gap when ambulances are committed",
      "MCI protocol guidance",
      "Live transcription of caller descriptions",
      "Air-medical mutual aid",
      "Supervisor command notes",
      "Continuity Log of every escalation",
    ],
    estimatedDurationSeconds: 320,
    manualAdvance: false,
    enabled: true,
    startingState: createStartingState({
      onShiftIds: ["D-01", "D-02", "D-03", "D-04", "D-05"],
      clockLabel: "16:05",
      recentActivity: ["Afternoon shift. Board is clear. Weather is dry."],
    }),
    events: [
      event("mci-01", 10, "CALL_RECEIVED", "Multi-vehicle accident, Interstate 47 ramp, injuries", {
        call: call({
          id: "call-mci",
          discipline: "ems",
          priority: "emergency",
          summary: "Three vehicles, injuries, interstate ramp",
          locationId: "loc-interstate",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("501"),
        }),
      }),
      event("mci-02", 16, "INCIDENT_CREATED", "Incident opened — Interstate 47 accident", {
        incident: incident({
          id: mci,
          callId: "call-mci",
          title: "Multi-vehicle accident",
          discipline: "ems",
          locationId: "loc-interstate",
          status: "active",
          openedAtSeconds: 16,
        }),
      }),
      event("mci-03", 22, "INCIDENT_UPDATED", "MCI classification — supervisor board flags a major incident", {
        incidentId: mci,
        patch: { mci: true, major: true, title: "MCI — Interstate 47, three vehicles" },
      }),
      event("mci-04", 26, "SUPERVISOR_ALERT", "Major incident flag on the supervisor dashboard", {
        message: "Major incident: MCI on Interstate 47 westbound ramp, mile marker 18.",
      }),
      event("mci-05", 30, "CALL_ASSIST_SUGGESTION", "Pre-arrival iQ — MCI protocol", {
        incidentId: mci,
        text: "Mass-casualty protocol. Ask for an exact vehicle count, entrapment, and the worst patient. Start a patient count.",
      }),
      event("mci-06", 36, "UNIT_DISPATCHED", "MED-2 dispatched to the interstate", {
        unitId: "MED-2",
        incidentId: mci,
        callId: "call-mci",
      }),
      event("mci-07", 40, "UNIT_DISPATCHED", "MED-6 dispatched to the interstate", {
        unitId: "MED-6",
        incidentId: mci,
        callId: "call-mci",
      }),
      event("mci-08", 44, "UNIT_DISPATCHED", "ENG-4 dispatched to the interstate", {
        unitId: "ENG-4",
        incidentId: mci,
        callId: "call-mci",
      }),
      event("mci-09", 48, "UNIT_DISPATCHED", "MC-14 dispatched for traffic control", {
        unitId: "MC-14",
        incidentId: mci,
        callId: "call-mci",
      }),
      event("mci-10", 56, "TRANSCRIPTION_UPDATE", "Caller: three cars, one on its side, people yelling", {
        incidentId: mci,
        speaker: "caller",
        text: "There are three cars. One is on its side. I can hear people yelling.",
      }),
      event("mci-11", 64, "CALL_RECEIVED", "Structure fire — Clearfield Industrial Park, Building 4, smoke showing", {
        call: call({
          id: "call-structure",
          discipline: "fire",
          priority: "emergency",
          summary: "Smoke showing, no occupant report yet",
          locationId: "loc-industrial",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("502"),
        }),
      }),
      event("mci-12", 70, "INCIDENT_CREATED", "Second incident — structure fire, industrial park", {
        incident: incident({
          id: structure,
          callId: "call-structure",
          title: "Structure fire — smoke showing",
          discipline: "fire",
          locationId: "loc-industrial",
          status: "active",
          major: true,
          openedAtSeconds: 70,
        }),
      }),
      event("mci-13", 76, "UNIT_DISPATCHED", "ENG-7 dispatched to Building 4", {
        unitId: "ENG-7",
        incidentId: structure,
        callId: "call-structure",
      }),
      event("mci-14", 88, "CALL_RECEIVED", "Additional caller on the interstate MCI", {
        call: call({
          id: "call-mci-2",
          discipline: "ems",
          priority: "emergency",
          summary: "Second caller — more injured people on the ramp",
          locationId: "loc-interstate",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("503"),
        }),
      }),
      event("mci-15", 94, "UNIT_DISPATCHED", "MED-11 activated for the MCI", {
        unitId: "MED-11",
        incidentId: mci,
        callId: "call-mci-2",
      }),
      event("mci-16", 102, "CONTINUITY_LOG_UPDATED", "Continuity Log — second caller, patient count rising", {
        incidentId: mci,
        entry: "Additional caller. MED-11 added. Early patient count is at least four.",
      }),
      event("mci-17", 112, "MUTUAL_AID_REQUESTED", "AIR-1 requested — mutual aid surface for the supervisor", {
        resource: "AIR-1",
        incidentId: mci,
        note: "Air medical requested. Mutual-aid panel is open for Casey Vance.",
      }),
      event("mci-18", 118, "UNIT_DISPATCHED", "AIR-1 assigned to the MCI", {
        unitId: "AIR-1",
        incidentId: mci,
        callId: "call-mci",
      }),
      event("mci-19", 126, "SUPERVISOR_ALERT", "Coverage gap — all ambulances committed", {
        message: "All ambulances are committed. County EMS has no available ALS or BLS unit.",
        coverageGap: true,
      }),
      event("mci-20", 136, "INCIDENT_UPDATED", "Structure fire — second alarm", {
        incidentId: structure,
        patch: { title: "Structure fire — second alarm" },
      }),
      event("mci-21", 142, "MUTUAL_AID_REQUESTED", "Mutual-aid fire company requested", {
        resource: "Mutual-aid engine from the next county",
        incidentId: structure,
        note: "Second alarm. Nearest Maplewood engine is on the interstate. Mutual aid requested.",
      }),
      event("mci-22", 154, "CONTINUITY_LOG_UPDATED", "Supervisor command note entered", {
        incidentId: mci,
        entry: "Casey Vance: interstate is the priority incident. Industrial fire is second. Air medical is en route.",
        commandNote: "Interstate is the priority. Industrial fire is second. Air medical en route.",
      }),
      event("mci-23", 166, "TRANSCRIPTION_UPDATE", "Caller reports six patients", {
        incidentId: mci,
        speaker: "caller",
        text: "I count six people hurt. Two are still in the rolled car.",
      }),
      event("mci-24", 172, "INCIDENT_UPDATED", "Patient count reported to dispatch — six", {
        incidentId: mci,
        patch: { patientCount: 6 },
      }),
      event("mci-25", 180, "UNIT_STATUS_CHANGED", "AIR-1 en route", {
        unitId: "AIR-1",
        incidentId: mci,
        status: "en_route",
      }),
      event("mci-26", 190, "UNIT_STATUS_CHANGED", "ENG-7 on scene at Building 4", {
        unitId: "ENG-7",
        incidentId: structure,
        status: "on_scene",
      }),
      event("mci-27", 198, "INCIDENT_UPDATED", "Structure fire contained", {
        incidentId: structure,
        patch: { status: "controlled", title: "Structure fire — contained" },
      }),
      event("mci-28", 206, "CONTINUITY_LOG_UPDATED", "Continuity Log — fire contained", {
        incidentId: structure,
        entry: "ENG-7 on scene. Fire contained to Building 4. No occupants found.",
      }),
      event("mci-29", 220, "UNIT_STATUS_CHANGED", "MED-2 transporting", {
        unitId: "MED-2",
        incidentId: mci,
        status: "transporting",
      }),
      event("mci-30", 228, "UNIT_STATUS_CHANGED", "MED-6 transporting", {
        unitId: "MED-6",
        incidentId: mci,
        status: "transporting",
      }),
      event("mci-31", 248, "INCIDENT_UPDATED", "MCI moving into controlled resolution", {
        incidentId: mci,
        patch: { status: "controlled", title: "MCI — patients transporting" },
      }),
      event("mci-32", 260, "SUPERVISOR_ALERT", "Supervisor timeline ready", {
        message: "Both incidents are in a controlled resolution. The timeline and unit log are on the command view.",
        shiftSummary:
          "MCI on Interstate 47 and a second-alarm fire at Clearfield Industrial Park. Six patients. Air medical used. Coverage gap lasted until transports began.",
        coverageGap: false,
      }),
    ],
  };
}

export function buildOvernightScenario(): DemoScenarioManifest {
  return {
    id: "demo-overnight",
    displayName: "Overnight Minimum Staffing",
    description:
      "02:00 at Maplewood County Communications. Two dispatchers on duty. Call Assist carries the non-emergency line.",
    audience: "Small PSAPs with two or three dispatchers",
    featureHighlights: [
      "Call Assist handling an information request",
      "Administrative queue with almost no dispatcher work",
      "Pre-arrival guidance without a third dispatcher",
      "Quiet-board metrics",
      "Remote supervisor view",
      "Overnight welfare-check protocol",
      "System health indicators",
    ],
    estimatedDurationSeconds: 240,
    manualAdvance: false,
    enabled: true,
    startingState: createStartingState({
      onShiftIds: ["D-02", "D-04", "D-05"],
      remoteIds: ["D-05"],
      clockLabel: "02:08",
      callsLast30Minutes: 2,
      recentActivity: [
        "02:00. Morgan Reyes on position 1. Sam Okafor on position 2.",
        "Casey Vance is remote and can open the center dashboard.",
        "Two calls in the last 30 minutes. System health: normal.",
      ],
    }),
    events: [
      event("on-01", 12, "ADMIN_CALL_ROUTED", "Road-condition inquiry handled by Call Assist", {
        call: call({
          id: "call-roads",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Are the county roads icy?",
          locationId: "loc-pine-switch",
          language: "en",
          status: "handled",
          repeatCaller: false,
          phone: fictionalPhone("601"),
        }),
        disposition: "Call Assist gave the overnight road note. No dispatcher joined the call.",
      }),
      event("on-02", 28, "CALL_RECEIVED", "911 medical — difficulty breathing, 640 Nightingale Lane", {
        call: call({
          id: "call-breathing",
          discipline: "ems",
          priority: "emergency",
          summary: "Difficulty breathing, residential",
          locationId: "loc-nightingale",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("602"),
        }),
      }),
      event("on-03", 34, "CALL_ANSWERED", "Morgan Reyes answered the breathing call", {
        callId: "call-breathing",
        positionId: "D-02",
      }),
      event("on-04", 40, "CALL_ASSIST_SUGGESTION", "Pre-arrival — breathing protocol, no third dispatcher required", {
        callId: "call-breathing",
        text: "Difficulty breathing. Ask if they can speak in full sentences. Keep them sitting up. ALS is the right send.",
      }),
      event("on-05", 46, "INCIDENT_CREATED", "Incident opened — difficulty breathing", {
        incident: incident({
          id: breathing,
          callId: "call-breathing",
          title: "Difficulty breathing",
          discipline: "ems",
          locationId: "loc-nightingale",
          status: "active",
          openedAtSeconds: 46,
        }),
      }),
      event("on-06", 52, "UNIT_DISPATCHED", "MED-2 dispatched to Nightingale Lane", {
        unitId: "MED-2",
        incidentId: breathing,
        callId: "call-breathing",
      }),
      event("on-07", 64, "ADMIN_CALL_ROUTED", "Noise complaint captured by Call Assist — pending dispatch", {
        call: call({
          id: "call-night-noise",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Music complaint, address and callback captured",
          locationId: "loc-willow-creek",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("603"),
        }),
        disposition: "Address and callback saved. Pending a deputy when one is free. Dispatcher did not leave the medical call.",
      }),
      event("on-08", 78, "CALL_RECEIVED", "Commercial alarm, 880 Harbor Alarm Way", {
        call: call({
          id: "call-alarm",
          discipline: "law",
          priority: "emergency",
          summary: "Alarm activation, commercial",
          locationId: "loc-harbor-alarm",
          language: "en",
          status: "queued",
          repeatCaller: false,
          phone: fictionalPhone("604"),
        }),
      }),
      event("on-09", 84, "INCIDENT_CREATED", "Incident opened — commercial alarm", {
        incident: incident({
          id: alarm,
          callId: "call-alarm",
          title: "Commercial alarm",
          discipline: "law",
          locationId: "loc-harbor-alarm",
          status: "active",
          openedAtSeconds: 84,
        }),
      }),
      event("on-10", 90, "UNIT_DISPATCHED", "MC-07 dispatched to the alarm", {
        unitId: "MC-07",
        incidentId: alarm,
        callId: "call-alarm",
      }),
      event("on-11", 104, "UNIT_STATUS_CHANGED", "MED-2 on scene", {
        unitId: "MED-2",
        incidentId: breathing,
        status: "on_scene",
      }),
      event("on-12", 112, "ADMIN_CALL_ROUTED", "Vehicle breakdown referred to road service", {
        call: call({
          id: "call-breakdown",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Car will not start on Pine Switch Road",
          locationId: "loc-pine-switch",
          language: "en",
          status: "handled",
          repeatCaller: false,
          phone: fictionalPhone("605"),
        }),
        disposition: "No injuries. Call Assist gave the county road-service number. No unit sent.",
      }),
      event("on-13", 124, "SUPERVISOR_ALERT", "Remote supervisor checked the center dashboard", {
        message: "Casey Vance opened the remote supervisor view. Two active incidents. MED-2 on scene. MC-07 en route to an alarm.",
      }),
      event("on-14", 136, "UNIT_STATUS_CHANGED", "MC-07 on scene at the alarm", {
        unitId: "MC-07",
        incidentId: alarm,
        status: "on_scene",
      }),
      event("on-15", 148, "CONTINUITY_LOG_UPDATED", "Alarm cleared — no entry", {
        incidentId: alarm,
        entry: "MC-07 on scene. Building secure. Alarm company cancelled. No entry.",
      }),
      event("on-16", 154, "UNIT_STATUS_CHANGED", "MC-07 available", {
        unitId: "MC-07",
        incidentId: alarm,
        status: "available",
      }),
      event("on-17", 156, "INCIDENT_CLOSED", "Alarm closed", {
        incidentId: alarm,
        summary: "False alarm. No entry. MC-07 available.",
      }),
      event("on-18", 168, "UNIT_STATUS_CHANGED", "MED-2 transporting to Maplewood Regional", {
        unitId: "MED-2",
        incidentId: breathing,
        status: "transporting",
      }),
      event("on-19", 188, "UNIT_STATUS_CHANGED", "MED-2 available", {
        unitId: "MED-2",
        incidentId: breathing,
        status: "available",
      }),
      event("on-20", 192, "INCIDENT_CLOSED", "Breathing call closed at Maplewood Regional", {
        incidentId: breathing,
        summary: "Patient delivered to Maplewood Regional Medical Center. MED-2 available.",
      }),
      event("on-21", 200, "SUPERVISOR_ALERT", "Overnight summary", {
        message: "Board is quiet. Call Assist handled three non-emergency calls. Both field units are available.",
        shiftSummary:
          "02:00–02:12 window: 1 emergency medical, 1 alarm, 3 non-emergency calls handled by Call Assist. Staffing: 2 dispatchers plus a remote supervisor.",
      }),
    ],
  };
}

function tourIncident(): DemoIncident {
  return incident({
    id: "inc-tour",
    callId: "call-tour",
    title: "Chest pain — elderly male",
    discipline: "ems",
    locationId: "loc-ridgemont-blvd",
    status: "active",
    openedAtSeconds: 0,
    units: ["MED-2"],
    callAssist:
      "Possible acute coronary syndrome. Ask about breathing, aspirin, and prior heart history. ALS is the right send.",
    translation: {
      language: "es",
      note: "A second line is standing by in Spanish: the caller on Clearfield Road said someone is hurt.",
    },
    continuity: [
      "Call received at 2847 Ridgemont Blvd.",
      "Alex Carver answered on position 1.",
      "MED-2 dispatched and is en route.",
    ],
    transcript: [
      {
        speaker: "dispatcher",
        text: "Maplewood 911. What is the address of the emergency?",
        offsetSeconds: 0,
      },
      {
        speaker: "caller",
        text: "2847 Ridgemont Boulevard. My father has crushing chest pain.",
        offsetSeconds: 0,
      },
      {
        speaker: "dispatcher",
        text: "Is he awake and breathing?",
        offsetSeconds: 0,
      },
    ],
    commandNotes: ["Casey Vance is watching position 1 from the supervisor desk."],
  });
}

export function buildGuidedTourScenario(): DemoScenarioManifest {
  const units: DemoUnit[] = availableUnits().map((unit) =>
    unit.id === "MED-2" ? { ...unit, status: "en_route", incidentId: "inc-tour" } : unit,
  );
  const closed = incident({
    id: "inc-tour-closed",
    callId: "call-tour-closed",
    title: "Noise complaint — cleared",
    discipline: "law",
    locationId: "loc-willow-creek",
    status: "closed",
    openedAtSeconds: 0,
    continuity: ["MC-14 responded. Music turned down. Closed for after-action review."],
  });

  return {
    id: "demo-guided-tour",
    displayName: "Guided Product Tour",
    description:
      "A presenter-paced walkthrough. Nothing advances until you move to the next stop. Built for screen recordings and investor pitches.",
    audience: "Screen recordings and non-technical audiences",
    featureHighlights: GUIDED_TOUR_CALLOUTS.map((stop) => stop.title),
    estimatedDurationSeconds: 0,
    manualAdvance: true,
    enabled: true,
    guidedHighlights: GUIDED_TOUR_CALLOUTS.map((stop) => ({ ...stop })),
    startingState: createStartingState({
      onShiftIds: ["D-01", "D-05"],
      clockLabel: "10:00",
      units,
      activeIncidents: [tourIncident()],
      closedIncidents: [closed],
      callsLast30Minutes: 4,
      callQueue: [
        call({
          id: "call-tour",
          discipline: "ems",
          priority: "emergency",
          summary: "Chest pain, elderly male — pre-arrival context is already on screen",
          locationId: "loc-ridgemont-blvd",
          language: "en",
          status: "active",
          positionId: "D-01",
          repeatCaller: false,
          phone: fictionalPhone("701"),
        }),
        call({
          id: "call-tour-admin",
          discipline: "admin",
          priority: "non-emergency",
          summary: "Road-condition question handled before it reached a dispatcher",
          locationId: "loc-pine-switch",
          language: "en",
          status: "handled",
          repeatCaller: false,
          phone: fictionalPhone("702"),
        }),
      ],
      recentActivity: [
        "Guided tour. Alex Carver is on position 1. Casey Vance is the supervisor.",
        "Advance each stop yourself. Playback does not move the tour.",
      ],
    }),
    events: [],
  };
}

export function buildAllScenarios(): DemoScenarioManifest[] {
  return [
    buildStandardScenario(),
    buildHighVolumeScenario(),
    buildMciScenario(),
    buildOvernightScenario(),
    buildGuidedTourScenario(),
  ];
}

/** Used by the event log when a summary should name a location from the catalog. */
export function scenarioLocationCheck(scenario: DemoScenarioManifest): string[] {
  const known = new Set(scenario.startingState.locations.map((location) => location.id));
  const missing: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "locationId" && typeof child === "string" && !known.has(child)) {
        missing.push(child);
      } else {
        visit(child);
      }
    }
  };
  visit(scenario.startingState);
  scenario.events.forEach((item) => visit(item.payload));
  void locationLabel;
  return missing;
}
