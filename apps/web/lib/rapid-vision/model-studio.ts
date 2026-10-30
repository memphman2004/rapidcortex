/**
 * Scene Intelligence model studio rules.
 * A trained file is not an approved detector. Web search results are not incidents.
 */

export const STUDIO_CATEGORIES = [
  { id: "firearm_like", name: "Firearm-like object", observable: "A handheld object with a firearm-like shape. Not a conclusion that a firearm is present or that anyone intends harm.", annotation: "Bounding box" },
  { id: "blade_like", name: "Knife or blade-like object", observable: "A blade-like shape, distinguished from phones, tools, and utensils by review.", annotation: "Bounding box" },
  { id: "altercation", name: "Physical altercation", observable: "Repeated aggressive contact across frames. A single frame is not enough.", annotation: "Video interval" },
  { id: "person_down", name: "Person down or fall", observable: "A person low to the ground or an apparent fall. Not a medical diagnosis.", annotation: "Video interval" },
  { id: "forced_entry", name: "Forced-entry indicators", observable: "A secured door moving open when a sensor or second view corroborates it.", annotation: "Video interval" },
  { id: "vehicle_collision", name: "Vehicle collision", observable: "Vehicles or a vehicle and a fixed object coming together in a monitored roadway.", annotation: "Video interval" },
  { id: "restricted_zone", name: "Restricted-zone entry", observable: "A person crossing into a drawn restricted zone during the hours that zone is closed.", annotation: "Zone event" },
  { id: "blocked_exit", name: "Blocked emergency exit", observable: "An obstruction in a drawn exit, stair, or fire-lane zone.", annotation: "Zone event" },
  { id: "transit_hazard", name: "Hazardous transit area", observable: "A person in a drawn track or guideway zone.", annotation: "Zone event" },
  { id: "smoke_or_flame", name: "Smoke or flame-like condition", observable: "Visible smoke or flame-like pixels. A scheduled venue effect can be excepted.", annotation: "Bounding box" },
] as const;

export type StudioCategoryId = (typeof STUDIO_CATEGORIES)[number]["id"];

export type ModelPhase =
  | "DRAFT"
  | "TRAINING"
  | "EVALUATION"
  | "REVIEW"
  | "APPROVED"
  | "SHADOW"
  | "PRODUCTION"
  | "RETIRED"
  | "REJECTED";

const TRAINABLE_LICENSES = new Set(["cc0", "pdm", "zero", "by", "by-sa"]);

export function licenseAllowsTraining(license: string | undefined): boolean {
  const raw = (license ?? "").trim().toLowerCase().replace(/^cc-/, "").replace(/\s+/g, "");
  if (!raw || raw.includes("nc") || raw.includes("nd") || raw.includes("unknown") || raw.includes("all-rights")) {
    return false;
  }
  return TRAINABLE_LICENSES.has(raw);
}

const BLOCKED_HOSTS = ["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "facebook.com", "x.com", "twitter.com"];

/** Official discovery APIs only. No arbitrary crawl and no audiovisual download. */
export function discoverySourceAllowed(source: string): boolean {
  return source === "openverse" || source === "wikimedia" || source === "huggingface";
}

export function blockedDiscoveryUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "The address is not a valid URL.";
  }
  if (parsed.protocol !== "https:") return "Only HTTPS sources are accepted.";
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("127.")) {
    return "Private network addresses are blocked.";
  }
  if (BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    return "That site is not an approved discovery source.";
  }
  return null;
}

export type DiscoveryCandidate = {
  id: string;
  title: string;
  mediaType: "image" | "video" | "dataset";
  source: "openverse" | "wikimedia" | "huggingface";
  sourceUrl: string;
  previewUrl: string | null;
  creator: string;
  license: string;
  trainable: boolean;
  review: "pending";
};

export function reviewDiscoveryCandidate(candidate: DiscoveryCandidate, decision: "approve" | "reject"): {
  ok: boolean;
  reason: string;
  createsSceneIncident: false;
  trainingEligible: boolean;
} {
  if (decision === "reject") {
    return { ok: true, reason: "Rejected. The file was not imported.", createsSceneIncident: false, trainingEligible: false };
  }
  if (!candidate.trainable || !licenseAllowsTraining(candidate.license)) {
    return {
      ok: false,
      reason: "This result is not eligible for training. Public visibility is not a license.",
      createsSceneIncident: false,
      trainingEligible: false,
    };
  }
  return {
    ok: true,
    reason: "Approved as a candidate record. The file is not in a training dataset until a person labels it and a dataset version is marked ready.",
    createsSceneIncident: false,
    trainingEligible: false,
  };
}

export function startTrainingJob(input: { datasetReady: boolean; backendConnected: boolean }): {
  status: "NOT_STARTED";
  progress: null;
  reason: string;
} {
  if (!input.datasetReady) {
    return { status: "NOT_STARTED", progress: null, reason: "The dataset is not marked training-ready." };
  }
  if (!input.backendConnected) {
    return {
      status: "NOT_STARTED",
      progress: null,
      reason: "SageMaker training is not connected. No job was submitted and no cost was incurred.",
    };
  }
  return { status: "NOT_STARTED", progress: null, reason: "The training service did not return a job id." };
}

export function canEnterProduction(input: { phase: ModelPhase; evaluationAccepted: boolean; artifactUri: string | null }): {
  ok: false;
  reason: string;
} {
  if (!input.evaluationAccepted) {
    return { ok: false, reason: "No accepted evaluation report is stored for this model." };
  }
  if (input.phase !== "APPROVED" && input.phase !== "SHADOW") {
    return { ok: false, reason: "Production requires an approved model. Training completion is not approval." };
  }
  if (!input.artifactUri) {
    return { ok: false, reason: "No model artifact is registered, so production activation is closed." };
  }
  return { ok: false, reason: "Live activation stays closed until an operational approver records acceptance for the target cameras." };
}
