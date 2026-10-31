/**
 * Scene Intelligence model studio rules.
 * A trained file is not an approved detector. Web search results are not incidents.
 */

export const STUDIO_CATEGORIES = [
  { id: "firearm_like", name: "Firearm-like object", observable: "A handheld object with a firearm-like shape. A visible shape is not a verified threat, and an officer's own firearm is not labeled as a suspected crime.", annotation: "Bounding box" },
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

export type TrainingLicense = "cc0" | "pdm" | "by" | "by-sa" | "ogl";

export const DISCOVERY_SUGGESTIONS: Record<StudioCategoryId, readonly string[]> = {
  firearm_like: ["handgun product photo", "handgun in a holster", "tool that resembles a handgun", "phone held in a hand"],
  blade_like: ["utility knife", "kitchen utensil", "box cutter"],
  altercation: ["physical altercation", "contact sport", "people exercising"],
  person_down: ["person lying on the ground", "person stretching on the floor"],
  forced_entry: ["forced door", "open doorway", "person at a closed door"],
  vehicle_collision: ["vehicle collision", "parked cars on a street"],
  restricted_zone: ["restricted area sign", "person walking into a closed area"],
  blocked_exit: ["blocked fire exit", "obstruction in a stairwell", "clear emergency exit"],
  transit_hazard: ["railway platform", "person on a train platform"],
  smoke_or_flame: ["visible smoke indoors", "stage flame effect"],
};

/** Map a license string to a reviewable grant. Non-commercial and no-derivatives stay out. */
export function canonicalTrainingLicense(license: string | undefined): TrainingLicense | null {
  const raw = (license ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (/\b(unknown|unspecified)\b/.test(raw) || /all[-\s]?rights/.test(raw)) return null;
  if (/non-?commercial|\bnc\b|by-?nc/.test(raw)) return null;
  if (/no-?deriv|\bnd\b|by-?nd/.test(raw)) return null;
  if (/open government|\bogl\b/.test(raw)) return "ogl";
  if (/public domain mark|\bpdm\b/.test(raw)) return "pdm";
  if (/public domain|\bcc-?0\b|\bcc-?zero\b|\bzero\b|\bpd\b/.test(raw)) return "cc0";
  if (/by-?sa|share-?alike/.test(raw)) return "by-sa";
  if (/\bby\b|attribution/.test(raw)) return "by";
  return null;
}

export function licenseAllowsTraining(license: string | undefined): boolean {
  return canonicalTrainingLicense(license) !== null;
}

export function trainingLicenseNote(license: string | undefined): string {
  const canonical = canonicalTrainingLicense(license);
  if (canonical === "ogl") {
    return "Open Government Licence. Credit the creator and do not imply the source endorses the product.";
  }
  if (canonical === "by" || canonical === "by-sa") {
    return "License may allow review. Keep the attribution with the file.";
  }
  if (canonical === "cc0" || canonical === "pdm") {
    return "License may allow review.";
  }
  return "Not eligible for training. Public visibility is not a license.";
}

const BLOCKED_HOSTS = ["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "facebook.com", "x.com", "twitter.com"];

/** Official discovery APIs only. No arbitrary crawl and no audiovisual download. */
export function discoverySourceAllowed(source: string): boolean {
  return source === "openverse" || source === "wikimedia" || source === "huggingface" || source === "internetarchive";
}

export function discoverySourceRefusal(source: string): string | null {
  if (source === "youtube") return "YouTube search is not connected. Downloading YouTube video is disabled.";
  if (source === "pexels" || source === "pixabay") {
    return "That source is not used for automated training collection.";
  }
  if (!discoverySourceAllowed(source)) {
    return "That source is not approved. YouTube downloads and open web crawls are not available.";
  }
  return null;
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

export type SceneFit = "studio" | "scene" | "dataset" | "unknown";

export type DiscoveryCandidate = {
  id: string;
  title: string;
  mediaType: "image" | "video" | "dataset";
  source: "openverse" | "wikimedia" | "huggingface" | "internetarchive";
  sourceUrl: string;
  previewUrl: string | null;
  playbackUrl: string | null;
  creator: string;
  license: string;
  trainable: boolean;
  review: "pending";
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sceneFit: SceneFit;
  fitNote: string;
  attribution: string | null;
  hasVideo: boolean;
  exampleRole: "positive" | "negative" | "unspecified";
};

const STUDIO_TITLE_HINTS = ["product photo", "product shot", "studio", "transparent", "white background", "isolated", "catalog", "catalogue", "packshot", "pack shot"];
const SCENE_TITLE_HINTS = ["cctv", "surveillance", "ceiling", "bodycam", "body-worn", "body worn", "holster", "footage", "platform", "night scene", "street camera"];

export function sceneFitForText(title: string, mediaType: DiscoveryCandidate["mediaType"]): { sceneFit: SceneFit; fitNote: string } {
  if (mediaType === "dataset") {
    return {
      sceneFit: "dataset",
      fitNote: "A dataset card is a lead, not labeled frames. Read the license and sample images before any import.",
    };
  }
  const text = title.toLowerCase();
  if (STUDIO_TITLE_HINTS.some((hint) => text.includes(hint))) {
    return {
      sceneFit: "studio",
      fitNote: "Studio or product photo. Useful as a shape reference. It does not stand in for a ceiling camera, body camera, or night scene.",
    };
  }
  if (SCENE_TITLE_HINTS.some((hint) => text.includes(hint))) {
    return {
      sceneFit: "scene",
      fitNote: "The title suggests a camera or scene view. Confirm the frame shows the category before anyone labels it.",
    };
  }
  return {
    sceneFit: "unknown",
    fitNote: "Scene fit is unknown from the title. Compare the frame with the cameras this model would watch.",
  };
}

export function plainDiscoveryText(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Accept an HTTPS preview or landing URL. Upgrade http to https, then apply the source block list. */
export function acceptedDiscoveryUrl(url: string | undefined | null): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  const upgraded = trimmed.startsWith("http://") ? `https://${trimmed.slice("http://".length)}` : trimmed;
  if (blockedDiscoveryUrl(upgraded)) return null;
  return upgraded;
}

function finiteSize(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function candidateFromOpenverse(hit: {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  license?: string;
  license_version?: string;
  creator?: string;
  foreign_landing_url?: string;
  width?: number;
  height?: number;
  attribution?: string;
}): DiscoveryCandidate | null {
  const sourceUrl = acceptedDiscoveryUrl(hit.foreign_landing_url) ?? acceptedDiscoveryUrl(hit.url);
  if (!sourceUrl || !hit.id) return null;
  const short = (hit.license ?? "").trim().toLowerCase();
  const version = (hit.license_version ?? "").trim();
  const ccName = ["by", "by-sa", "by-nc", "by-nd", "by-nc-sa", "by-nc-nd"].includes(short) ? `CC ${short.toUpperCase()}` : (hit.license ?? "");
  const license = [ccName, version].filter(Boolean).join(" ") || "unspecified";
  const title = plainDiscoveryText(hit.title).slice(0, 180) || "Untitled";
  const fit = sceneFitForText(title, "image");
  return {
    id: `openverse-${hit.id}`,
    title,
    mediaType: "image",
    source: "openverse",
    sourceUrl,
    previewUrl: acceptedDiscoveryUrl(hit.thumbnail),
    creator: plainDiscoveryText(hit.creator).slice(0, 180) || "Unlisted creator",
    license,
    trainable: licenseAllowsTraining(license),
    review: "pending",
    width: finiteSize(hit.width),
    height: finiteSize(hit.height),
    attribution: plainDiscoveryText(hit.attribution).slice(0, 240) || null,
    playbackUrl: null,
    durationSeconds: null,
    hasVideo: false,
    exampleRole: "unspecified",
    ...fit,
  };
}

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME = new Set(["video/webm", "video/mp4", "video/ogg"]);

function wikimediaPlayback(url: string | undefined, mime: string): string | null {
  if (!VIDEO_MIME.has(mime)) return null;
  const accepted = acceptedDiscoveryUrl(url);
  if (!accepted) return null;
  const host = new URL(accepted).hostname.toLowerCase();
  if (host !== "upload.wikimedia.org" && !host.endsWith(".wikimedia.org")) return null;
  return accepted;
}

export function candidateFromWikimediaPage(page: {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    url?: string;
    mime?: string;
    width?: number;
    height?: number;
    duration?: number;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }>;
}, options?: { media?: "image" | "video" }): DiscoveryCandidate | null {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const mime = (info.mime ?? "").toLowerCase();
  const wantVideo = options?.media === "video";
  if (wantVideo) {
    if (!VIDEO_MIME.has(mime)) return null;
  } else if (mime && !IMAGE_MIME.has(mime)) {
    return null;
  }
  const sourceUrl = acceptedDiscoveryUrl(info.descriptionurl);
  if (!sourceUrl) return null;
  const meta = info.extmetadata ?? {};
  const license = plainDiscoveryText(meta.LicenseShortName?.value).slice(0, 120) || "unspecified";
  const creator = plainDiscoveryText(meta.Artist?.value) || plainDiscoveryText(meta.Credit?.value) || "See the Commons file page";
  const title = plainDiscoveryText(page.title).replace(/^File:/i, "").slice(0, 180) || "Commons file";
  const description = plainDiscoveryText(meta.ImageDescription?.value);
  const mediaType = wantVideo ? "video" : "image";
  const fit = sceneFitForText(`${title} ${description}`, mediaType);
  const durationSeconds = typeof info.duration === "number" && Number.isFinite(info.duration) && info.duration > 0 ? info.duration : null;
  return {
    id: `wikimedia-${page.pageid ?? title}`,
    title,
    mediaType,
    source: "wikimedia",
    sourceUrl,
    previewUrl: acceptedDiscoveryUrl(info.thumburl),
    playbackUrl: wantVideo ? wikimediaPlayback(info.url, mime) : null,
    creator: creator.slice(0, 180),
    license,
    trainable: licenseAllowsTraining(license),
    review: "pending",
    width: finiteSize(info.width),
    height: finiteSize(info.height),
    durationSeconds,
    attribution: plainDiscoveryText(meta.Attribution?.value).slice(0, 240) || plainDiscoveryText(meta.Credit?.value).slice(0, 240) || null,
    hasVideo: wantVideo,
    exampleRole: "unspecified",
    ...fit,
  };
}

export function candidateFromHuggingFace(row: {
  id?: string;
  author?: string;
  tags?: string[];
  cardData?: { license?: string | string[] };
}): DiscoveryCandidate | null {
  const id = (row.id ?? "").trim();
  const parts = id.split("/");
  if (parts.length !== 2 || parts.some((part) => !/^[\w][\w.-]*$/.test(part))) return null;
  const tagged = (row.tags ?? []).find((tag) => tag.toLowerCase().startsWith("license:"));
  const cardLicense = Array.isArray(row.cardData?.license) ? row.cardData?.license[0] : row.cardData?.license;
  const license = (tagged ? tagged.slice("license:".length) : cardLicense ?? "").trim() || "unspecified";
  const sourceUrl = acceptedDiscoveryUrl(`https://huggingface.co/datasets/${id}`);
  if (!sourceUrl) return null;
  const fit = sceneFitForText(id, "dataset");
  const tags = (row.tags ?? []).map((tag) => tag.toLowerCase());
  const hasVideo = tags.some((tag) => tag.includes("video"));
  return {
    id: `hf-${id}`,
    title: id,
    mediaType: "dataset",
    source: "huggingface",
    sourceUrl,
    previewUrl: null,
    playbackUrl: null,
    creator: plainDiscoveryText(row.author).slice(0, 180) || id.slice(0, id.indexOf("/")),
    license,
    trainable: licenseAllowsTraining(license),
    review: "pending",
    width: null,
    height: null,
    durationSeconds: null,
    attribution: null,
    hasVideo,
    exampleRole: "unspecified",
    ...fit,
  };
}

export function candidateFromInternetArchive(doc: {
  identifier?: string;
  title?: string;
  description?: string;
  creator?: string | string[];
  licenseurl?: string;
}): DiscoveryCandidate | null {
  const identifier = (doc.identifier ?? "").trim();
  if (!/^[\w][\w.-]{0,120}$/.test(identifier) || identifier.includes("..")) return null;
  const sourceUrl = acceptedDiscoveryUrl(`https://archive.org/details/${identifier}`);
  if (!sourceUrl) return null;
  const licenseUrl = (doc.licenseurl ?? "").trim().toLowerCase();
  let license = "unspecified";
  if (licenseUrl.includes("creativecommons.org")) {
    if (licenseUrl.includes("by-nc") || licenseUrl.includes("by-nd")) license = licenseUrl;
    else if (licenseUrl.includes("by-sa")) license = "CC BY-SA";
    else if (licenseUrl.includes("/by/")) license = "CC BY";
    else if (licenseUrl.includes("/zero/") || licenseUrl.includes("publicdomain")) license = "CC0";
  } else if (/open government|\bogl\b/.test(licenseUrl)) {
    license = "Open Government Licence";
  }
  const creator = Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator ?? "");
  const title = plainDiscoveryText(doc.title).slice(0, 180) || identifier;
  const description = plainDiscoveryText(doc.description).slice(0, 400);
  const fit = sceneFitForText(`${title} ${description}`, "video");
  return {
    id: `ia-${identifier}`,
    title,
    mediaType: "video",
    source: "internetarchive",
    sourceUrl,
    previewUrl: null,
    playbackUrl: null,
    creator: plainDiscoveryText(creator).slice(0, 180) || "Internet Archive",
    license,
    trainable: licenseAllowsTraining(license),
    review: "pending",
    width: null,
    height: null,
    durationSeconds: null,
    attribution: null,
    hasVideo: true,
    exampleRole: "unspecified",
    ...fit,
  };
}

export function uniqueDiscoveryCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.sourceUrl)) return false;
    seen.add(candidate.sourceUrl);
    return true;
  });
}

export function reviewDiscoveryCandidate(candidate: DiscoveryCandidate, decision: "approve" | "reject"): {
  ok: boolean;
  reason: string;
  createsSceneIncident: false;
  trainingEligible: boolean;
} {
  if (blockedDiscoveryUrl(candidate.sourceUrl)) {
    return {
      ok: false,
      reason: "This address is not an approved discovery source. The file was not imported.",
      createsSceneIncident: false,
      trainingEligible: false,
    };
  }
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
  const shapeNote = candidate.sceneFit === "studio"
    ? "Approved as a shape reference only. A studio photo is not camera-scene footage. "
    : "Approved as a candidate record. ";
  return {
    ok: true,
    reason: `${shapeNote}The file is not in a training dataset until a person labels it and a dataset version is marked ready.`,
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

export type SearchConcept = { query: string; role: "positive" | "negative"; note: string };

export const SEARCH_EXPANSION: Record<StudioCategoryId, readonly SearchConcept[]> = {
  firearm_like: [
    { query: "person carrying a firearm in parking garage surveillance footage", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "handgun in a holster on security camera", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "tool that resembles a handgun", role: "negative", note: "A similar shape that is not the target." },
    { query: "phone held in a hand", role: "negative", note: "A similar shape that is not the target." },
  ],
  blade_like: [
    { query: "blade-like object in a person's hand", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "distant blade-like object low light", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "kitchen utensil in normal use", role: "negative", note: "A similar shape that is not the target." },
    { query: "tool resembling a knife", role: "negative", note: "A similar shape that is not the target." },
  ],
  altercation: [
    { query: "repeated striking motion security footage", role: "positive", note: "A still frame cannot establish this event." },
    { query: "physical confrontation in a corridor", role: "positive", note: "A still frame cannot establish this event." },
    { query: "contact sport", role: "negative", note: "Similar motion that is not the target event." },
    { query: "people exercising", role: "negative", note: "Similar motion that is not the target event." },
  ],
  person_down: [
    { query: "person falling in a parking garage", role: "positive", note: "A still frame cannot establish a fall." },
    { query: "person lying on the ground security camera", role: "positive", note: "Search instruction, not a medical finding." },
    { query: "person stretching on the floor", role: "negative", note: "A similar posture that is not the target event." },
  ],
  forced_entry: [
    { query: "door forced open security camera", role: "positive", note: "A still frame cannot establish forced entry." },
    { query: "person at a closed door", role: "negative", note: "A similar scene that is not the target event." },
  ],
  vehicle_collision: [
    { query: "vehicle collision intersection camera", role: "positive", note: "A still frame cannot establish a collision." },
    { query: "parked cars on a street", role: "negative", note: "A similar scene that is not the target event." },
  ],
  restricted_zone: [
    { query: "person entering a closed restricted area", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "person walking past a restricted area sign", role: "negative", note: "A similar scene that is not the target event." },
  ],
  blocked_exit: [
    { query: "obstruction in a fire exit", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "clear emergency exit", role: "negative", note: "A similar scene that is not the target event." },
  ],
  transit_hazard: [
    { query: "person on a train platform edge", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "empty railway platform", role: "negative", note: "A similar scene that is not the target event." },
  ],
  smoke_or_flame: [
    { query: "visible smoke indoors security camera", role: "positive", note: "Search instruction, not evidence an event occurred." },
    { query: "stage flame effect", role: "negative", note: "A similar appearance that may be a scheduled effect." },
  ],
};

export function exampleRoleForQuery(category: StudioCategoryId, query: string): SearchConcept["role"] | "unspecified" {
  const match = SEARCH_EXPANSION[category].find((concept) => concept.query.toLowerCase() === query.trim().toLowerCase());
  return match?.role ?? "unspecified";
}

const MOTION_CATEGORIES = new Set<StudioCategoryId>([
  "altercation",
  "person_down",
  "forced_entry",
  "vehicle_collision",
  "restricted_zone",
  "blocked_exit",
  "transit_hazard",
]);

export type RightsStatus =
  | "UNKNOWN"
  | "REVIEW_REQUIRED"
  | "LICENSE_VERIFIED"
  | "APPROVED_FOR_IMPORT"
  | "APPROVED_FOR_TRAINING"
  | "RESTRICTED"
  | "REJECTED"
  | "EXPIRED";

export type RightsRecord = {
  status: RightsStatus;
  commercialUse: "allowed" | "not_allowed" | "unknown";
  modelTraining: "allowed" | "not_allowed" | "unknown";
  modification: "allowed" | "not_allowed" | "unknown";
  attributionRequired: boolean;
  evidence: string;
  reviewerId: string | null;
  approvedAt: string | null;
  legalGuarantee: false;
};

/** A license reading is not approval and not a legal opinion. */
export function assessTrainingRights(input: { license: string; source: string }): RightsRecord {
  if (input.source === "youtube" || input.source === "pexels" || input.source === "pixabay") {
    return {
      status: "RESTRICTED",
      commercialUse: "not_allowed",
      modelTraining: "not_allowed",
      modification: "not_allowed",
      attributionRequired: false,
      evidence: "This source is not authorized for automated training collection.",
      reviewerId: null,
      approvedAt: null,
      legalGuarantee: false,
    };
  }
  const canonical = canonicalTrainingLicense(input.license);
  if (!canonical) {
    const named = input.license.trim().length > 0 && !/unspecified|unknown/i.test(input.license);
    return {
      status: named ? "RESTRICTED" : "UNKNOWN",
      commercialUse: named ? "not_allowed" : "unknown",
      modelTraining: "not_allowed",
      modification: named ? "not_allowed" : "unknown",
      attributionRequired: false,
      evidence: named
        ? "The recorded license does not grant commercial training use."
        : "No license was recorded. Public availability is not permission.",
      reviewerId: null,
      approvedAt: null,
      legalGuarantee: false,
    };
  }
  const shareAlike = canonical === "by-sa";
  return {
    status: "REVIEW_REQUIRED",
    commercialUse: "allowed",
    modelTraining: "allowed",
    modification: shareAlike ? "allowed" : "allowed",
    attributionRequired: canonical === "by" || canonical === "by-sa" || canonical === "ogl",
    evidence: shareAlike
      ? "The license text allows commercial use and requires share-alike. A person still has to confirm it."
      : "The license text appears to allow commercial use. A person still has to confirm it. This is not a legal guarantee.",
    reviewerId: null,
    approvedAt: null,
    legalGuarantee: false,
  };
}

const RIGHTS_ORDER: RightsStatus[] = ["REVIEW_REQUIRED", "LICENSE_VERIFIED", "APPROVED_FOR_IMPORT", "APPROVED_FOR_TRAINING"];

export function applyRightsDecision(input: {
  current: RightsRecord;
  decision: "verify-license" | "approve-import" | "approve-training" | "reject";
  reviewerId: string;
  at: string;
}): { ok: boolean; record: RightsRecord; reason: string } {
  if (input.current.status === "RESTRICTED" || input.current.status === "UNKNOWN" || input.current.status === "EXPIRED") {
    return { ok: false, record: input.current, reason: "This item cannot be approved. The license evidence does not permit commercial training." };
  }
  if (input.decision === "reject") {
    return {
      ok: true,
      record: { ...input.current, status: "REJECTED", reviewerId: input.reviewerId, approvedAt: input.at, modelTraining: "not_allowed" },
      reason: "Rejected. The file was not imported.",
    };
  }
  const next: Record<Exclude<typeof input.decision, "reject">, RightsStatus> = {
    "verify-license": "LICENSE_VERIFIED",
    "approve-import": "APPROVED_FOR_IMPORT",
    "approve-training": "APPROVED_FOR_TRAINING",
  };
  const expected = RIGHTS_ORDER[RIGHTS_ORDER.indexOf(input.current.status) + 1];
  if (next[input.decision] !== expected) {
    return { ok: false, record: input.current, reason: "That approval is out of order. Verify the license, then import, then training." };
  }
  return {
    ok: true,
    record: { ...input.current, status: next[input.decision], reviewerId: input.reviewerId, approvedAt: input.at },
    reason: next[input.decision] === "APPROVED_FOR_TRAINING"
      ? "Marked approved for training. No file was copied and no dataset version was written."
      : "Rights status updated. No file was copied.",
  };
}

export function requestMediaImport(input: { status: RightsStatus; storageConnected: boolean }): { ok: false; reason: string } {
  if (input.status !== "APPROVED_FOR_IMPORT" && input.status !== "APPROVED_FOR_TRAINING") {
    return { ok: false, reason: "Import refused. Training use is not approved for this file." };
  }
  if (!input.storageConnected) {
    return { ok: false, reason: "Media storage is not connected. No file was copied." };
  }
  return { ok: false, reason: "The import worker did not return a stored object." };
}

export type GapExample = {
  category: StudioCategoryId;
  sceneFit: SceneFit;
  title: string;
  mediaType: DiscoveryCandidate["mediaType"];
  role?: "positive" | "negative" | "unspecified";
  lighting?: "day" | "night" | "low_light" | null;
  cameraAngle?: string | null;
  rights?: RightsStatus;
};

export function datasetGapAnalysis(items: GapExample[]): { category: string; need: string }[] {
  const gaps: { category: string; need: string }[] = [];
  for (const category of STUDIO_CATEGORIES) {
    const rows = items.filter((item) => item.category === category.id);
    const positives = rows.filter((item) => item.role !== "negative");
    if (positives.length === 0) {
      gaps.push({ category: category.name, need: "No approved examples in this review set." });
      continue;
    }
    const trainingRows = rows.filter((item) => !item.rights || item.rights === "APPROVED_FOR_TRAINING");
    if (rows.some((item) => item.rights) && trainingRows.length === 0) {
      gaps.push({ category: category.name, need: "No example is approved for training." });
    }
    if (!positives.some((item) => item.sceneFit === "scene")) {
      gaps.push({ category: category.name, need: "No camera-scene example. A studio or product photo does not cover this." });
    }
    const labeledLight = positives.filter((item) => item.lighting);
    if (labeledLight.length === 0) {
      gaps.push({ category: category.name, need: "Lighting coverage unknown. Night and low light have not been labeled." });
    } else if (!labeledLight.some((item) => item.lighting === "night" || item.lighting === "low_light")) {
      gaps.push({ category: category.name, need: "No nighttime or low-light example is labeled." });
    }
    if (!positives.some((item) => item.cameraAngle)) {
      gaps.push({ category: category.name, need: "Camera-angle coverage unknown. Overhead, doorway, and distant views have not been labeled." });
    }
    if ((category.id === "blade_like" || category.id === "firearm_like") && !rows.some((item) => item.role === "negative")) {
      gaps.push({ category: category.name, need: "No harmless lookalike, such as a tool, utensil, or phone." });
    }
    if (MOTION_CATEGORIES.has(category.id) && positives.every((item) => item.mediaType === "image")) {
      gaps.push({ category: category.name, need: "Only still images. This event needs a video interval so motion can be reviewed." });
    }
  }
  return gaps;
}

function clipClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Record a human-selected interval. Extraction stays disconnected until a media job exists. */
export function planVideoClip(input: { durationSeconds: number | null; startSeconds: number; endSeconds: number }): {
  ok: false;
  reason: string;
  extraction: "NOT_CONNECTED";
} {
  const start = input.startSeconds;
  const end = input.endSeconds;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return { ok: false, reason: "The clip needs a start time before the end time.", extraction: "NOT_CONNECTED" };
  }
  if (end - start < 1) {
    return { ok: false, reason: "A training clip needs at least one second.", extraction: "NOT_CONNECTED" };
  }
  if (end - start > 60) {
    return { ok: false, reason: "Keep a training clip to 60 seconds or less.", extraction: "NOT_CONNECTED" };
  }
  if (input.durationSeconds != null && end > input.durationSeconds + 0.05) {
    return { ok: false, reason: "The clip ends after the recording.", extraction: "NOT_CONNECTED" };
  }
  return {
    ok: false,
    reason: `Interval ${clipClock(start)}–${clipClock(end)} is noted. Clip extraction is not connected, so no file was written.`,
    extraction: "NOT_CONNECTED",
  };
}

const ENVIRONMENT_TERMS: Record<string, readonly string[]> = {
  "parking garage": ["garage", "parking"],
  campus: ["campus", "university"],
  school: ["school"],
  stadium: ["stadium"],
  airport: ["airport"],
  transit: ["transit", "platform", "station"],
  street: ["street", "intersection"],
  entrance: ["entrance", "doorway", "door"],
  corridor: ["corridor", "hallway"],
  warehouse: ["warehouse"],
  park: ["park"],
};

const LIGHTING_TERMS: Record<string, readonly string[]> = {
  day: ["day", "daytime", "daylight"],
  night: ["night", "nighttime"],
  "low light": ["low light", "low-light", "dark"],
  indoor: ["indoor"],
  backlit: ["backlit", "backlight"],
  infrared: ["infrared", "thermal"],
};

export function withinMediaBounds(
  candidate: { durationSeconds: number | null; width: number | null },
  bounds: { minDuration?: number; minWidth?: number },
): "keep" | "missing" | "exclude" {
  if (bounds.minDuration && bounds.minDuration > 0) {
    if (candidate.durationSeconds == null) return "missing";
    if (candidate.durationSeconds < bounds.minDuration) return "exclude";
  }
  if (bounds.minWidth && bounds.minWidth > 0) {
    if (candidate.width == null) return "missing";
    if (candidate.width < bounds.minWidth) return "exclude";
  }
  return "keep";
}

/** Title match applied after a provider search. This is not a provider filter. */
export function titleMatchesDiscoveryFilter(title: string, filter: { environment?: string; lighting?: string }): boolean {
  const text = ` ${title.toLowerCase()} `;
  const environment = (filter.environment ?? "").trim().toLowerCase();
  const lighting = (filter.lighting ?? "").trim().toLowerCase();
  if (environment) {
    const terms = ENVIRONMENT_TERMS[environment] ?? [environment];
    const matched = terms.some((term) => (term === "park" ? /\bpark\b/.test(text) && !text.includes("parking") : text.includes(term)));
    if (!matched) return false;
  }
  if (lighting) {
    const terms = LIGHTING_TERMS[lighting] ?? [lighting];
    if (!terms.some((term) => text.includes(term))) return false;
  }
  return true;
}

export const DISCOVERY_SOURCE_POLICY = [
  { id: "wikimedia", name: "Wikimedia Commons", state: "Search", detail: "File-level license from Commons. A video plays only from a Wikimedia file address." },
  { id: "huggingface", name: "Hugging Face datasets", state: "Search", detail: "Dataset cards only. A public repository is not a training right." },
  { id: "internetarchive", name: "Internet Archive", state: "Metadata", detail: "Titles and source links. Files are not downloaded." },
  { id: "openverse", name: "Openverse", state: "Images", detail: "Still images. This source does not supply the video search." },
  { id: "youtube", name: "YouTube", state: "Disabled", detail: "No download. Search is not connected because no API key is configured." },
  { id: "pexels", name: "Pexels", state: "Disabled", detail: "Not used for automated training collection." },
  { id: "pixabay", name: "Pixabay", state: "Disabled", detail: "Not used for automated training collection." },
  { id: "agency", name: "Agency-authorized footage", state: "Closed", detail: "Upload stays closed until a reviewed bucket and malware scan are connected." },
] as const;

export type ReadinessFactor = { name: string; state: "not_completed" | "insufficient" | "unknown" | "recorded"; detail: string };

export function trainingReadiness(category: StudioCategoryId, examples: GapExample[], evaluationStored: boolean): {
  headline: "Needs review";
  factors: ReadinessFactor[];
  search: { query: string; media: "image" | "video"; role: "positive" | "negative" };
} {
  const rows = examples.filter((item) => item.category === category);
  const approved = rows.filter((item) => item.rights === "APPROVED_FOR_TRAINING");
  const positives = approved.filter((item) => item.role !== "negative");
  const negatives = approved.filter((item) => item.role === "negative");
  const concepts = SEARCH_EXPANSION[category];
  const needVideo = MOTION_CATEGORIES.has(category);
  const searchConcept = negatives.length === 0
    ? concepts.find((item) => item.role === "negative") ?? concepts[0]
    : concepts.find((item) => item.role === "positive") ?? concepts[0];
  return {
    headline: "Needs review",
    factors: [
      {
        name: "Dataset rights verification",
        state: approved.length > 0 ? "recorded" : "not_completed",
        detail: approved.length > 0 ? `${approved.length} approved for training in this set.` : "No item is approved for training.",
      },
      {
        name: "Positive and negative examples",
        state: positives.length > 0 && negatives.length > 0 ? "recorded" : "insufficient",
        detail: `${positives.length} positive, ${negatives.length} lookalike.`,
      },
      {
        name: "Camera environment coverage",
        state: approved.some((item) => item.lighting || item.cameraAngle) ? "insufficient" : "unknown",
        detail: approved.some((item) => item.lighting || item.cameraAngle)
          ? "Some conditions are labeled. Unlabeled conditions stay unknown."
          : "Coverage unknown. Lighting and camera angle have not been labeled.",
      },
      {
        name: "Held-out model evaluation",
        state: evaluationStored ? "recorded" : "not_completed",
        detail: evaluationStored ? "An evaluation report is stored." : "Not completed. No evaluation report is stored.",
      },
    ],
    search: { query: searchConcept.query, media: needVideo ? "video" : "image", role: searchConcept.role },
  };
}

export function buildDatasetVersion(input: { approvedForTraining: number }): { ok: false; reason: string } {
  if (input.approvedForTraining < 1) {
    return { ok: false, reason: "No item is approved for training. A reviewable license is not approval, and no dataset version was written." };
  }
  return { ok: false, reason: "Dataset storage is not connected. No version was written." };
}
