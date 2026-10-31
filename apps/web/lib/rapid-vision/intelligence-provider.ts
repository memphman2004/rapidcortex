/**
 * Scene Intelligence reuses the secret `rapid-cortex/ai/openai`.
 * The browser never receives the key. Arbitrary agency frames stay closed.
 * A saved diagnostic may show the last server-side test. Those results are
 * not approved training data.
 */

export const EXISTING_OPENAI_SECRET_NAME = "rapid-cortex/ai/openai";

export const SCENE_OPENAI_MODEL_ROLES = [
  { role: "Training assistant", id: "gpt-6.1-sol" },
  { role: "Visual review", id: "gpt-6.1-terra" },
  { role: "Metadata classification", id: "gpt-6-luna" },
  { role: "Synthetic images", id: "gpt-image-2.5-flare" },
  { role: "Synthetic image editing", id: "gpt-image-2.5-sunburst" },
] as const;

export type StudioQueueItem = {
  id: string;
  kind: "visual-review" | "synthetic-image";
  status: "REVIEW_REQUIRED";
  approved: false;
  modelId: string;
  createdAt: string;
  synthetic?: boolean;
  source?: string;
  objects?: string[];
  uncertainty?: string;
  annotation?: string;
  prompt?: string;
  category?: string;
  file?: string;
};

export type StudioDiagnostic = {
  checkedAt: string;
  secretRetrieval: "PASS" | "FAIL";
  secretFormat: string;
  executionRole?: "PASS" | "FAIL";
  executionRoleDetail?: string;
  authentication: "PASS" | "FAIL" | "NOT_RUN";
  authenticationDetail: string;
  models: Array<{ id: string; listed: boolean; request: "PASS" | "FAIL" | "restricted" | "NOT_RUN"; detail: string }>;
  visualAnalysis: "PASS" | "FAIL" | "NOT_RUN";
  visualDetail: string;
  imageGeneration: "PASS" | "FAIL" | "NOT_RUN";
  imageDetail: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; imageOutputTokens: number };
  queue: StudioQueueItem[];
};

export type IntelligenceProviderStatus = {
  secretName: string;
  keyExposedToBrowser: false;
  connection: "PASS" | "FAIL" | "NOT_RUN";
  secretRetrieval: "PASS" | "FAIL" | "NOT_RUN";
  secretFormat: string;
  executionRole: "PASS" | "FAIL" | "NOT_CHECKED";
  executionRoleDetail: string;
  frameReview: "closed";
  frameReviewReason: string;
  detector: "NOT_CONFIGURED";
  detectorReason: string;
  liveAlertsDependOnOpenAI: false;
  trainingCanPulseSidebar: false;
  cadDispatch: "human_only";
  lastSuccessAt: string | null;
  lastError: string | null;
  visualAnalysis: "PASS" | "FAIL" | "NOT_RUN";
  imageGeneration: "PASS" | "FAIL" | "NOT_RUN";
  usage: StudioDiagnostic["usage"] | null;
  estimatedCostUsd: null;
  costNote: string;
  models: Array<{ role: string; id: string; availability: "accessible" | "unavailable" | "restricted" | "unverified" }>;
  queue: StudioQueueItem[];
};

export function intelligenceProviderStatus(diagnostic?: StudioDiagnostic | null): IntelligenceProviderStatus {
  const queue = (diagnostic?.queue ?? []).map((item) => ({ ...item, status: "REVIEW_REQUIRED" as const, approved: false as const }));
  return {
    secretName: EXISTING_OPENAI_SECRET_NAME,
    keyExposedToBrowser: false,
    connection: diagnostic?.authentication ?? "NOT_RUN",
    secretRetrieval: diagnostic?.secretRetrieval ?? "NOT_RUN",
    secretFormat: diagnostic?.secretFormat ?? "Not read by this server.",
    executionRole: diagnostic?.executionRole ?? "NOT_CHECKED",
    executionRoleDetail: diagnostic?.executionRoleDetail ?? "The backend role was not checked in this response.",
    frameReview: "closed",
    frameReviewReason: "Agency footage is not sent from this page. The saved tests used one public Commons photograph and one generated image.",
    detector: "NOT_CONFIGURED",
    detectorReason: "No validated live-video detector is deployed. OpenAI is not the weapon detector.",
    liveAlertsDependOnOpenAI: false,
    trainingCanPulseSidebar: false,
    cadDispatch: "human_only",
    lastSuccessAt: diagnostic?.lastSuccessAt ?? null,
    lastError: diagnostic?.lastError ?? null,
    visualAnalysis: diagnostic?.visualAnalysis ?? "NOT_RUN",
    imageGeneration: diagnostic?.imageGeneration ?? "NOT_RUN",
    usage: diagnostic?.usage ?? null,
    estimatedCostUsd: null,
    costNote: "The API returned token counts and did not return a dollar amount.",
    models: SCENE_OPENAI_MODEL_ROLES.map((item) => {
      const found = diagnostic?.models.find((row) => row.id === item.id);
      const availability = found?.request === "PASS" && found.listed ? "accessible" : found?.request === "restricted" ? "restricted" : found ? "unavailable" : "unverified";
      return { role: item.role, id: item.id, availability };
    }),
    queue,
  };
}

export function refuseFrameExport(): { ok: false; sent: false; reason: string } {
  return {
    ok: false,
    sent: false,
    reason: "No frame was sent. Agency footage stays on this account, and the saved test results are not approved for training.",
  };
}
