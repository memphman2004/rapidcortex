/**
 * Scene model sequencing.
 * Phase 1 is Rekognition DetectLabels and does not train.
 * Later phases stay idle until the footage source is documented.
 */

export const SCENE_MODEL_PHASES = [
  {
    id: 1,
    name: "Rekognition DetectLabels",
    state: "Current detector",
    detail: "Amazon's built-in labels. A gun, knife, fight, or collision label is only a hint. No training images are used.",
  },
  {
    id: 2,
    name: "Rekognition Custom Labels",
    state: "Not started",
    detail: "Classes are defined for a weapon-like object, a blade, an altercation, a person down, forced entry, and a vehicle collision. The job waits for labeled camera-scene examples from a signed agency agreement or a synthetic render pipeline you own.",
  },
  {
    id: 3,
    name: "SageMaker fine-tune",
    state: "Not started",
    detail: "Uses those same cleared inputs. Getty or Shutterstock counts only after a contract that states AI training rights.",
  },
] as const;

export type TrainingPhase = 1 | 2 | 3;

export type ClearedTrainingInput =
  | {
      kind: "agency-dua";
      agreementId: string;
      lineageRecorded: boolean;
      restrictedBucket: boolean;
      facesBlurredBeforeExport: boolean;
    }
  | {
      kind: "owned-synthetic";
      labeledAtGeneration: boolean;
      partition: "synthetic";
    }
  | {
      kind: "stock-ai-license";
      vendor: "getty" | "shutterstock";
      contractSigned: boolean;
      trainingRights: boolean;
    }
  | { kind: "none" };

export function clearedTrainingInput(input: { phase: TrainingPhase; source: ClearedTrainingInput }): { ok: false; reason: string } | { ok: true } {
  if (input.phase === 1) {
    return { ok: false, reason: "Phase 1 uses Rekognition DetectLabels. No training job is submitted." };
  }
  const source = input.source;
  if (source.kind === "none") {
    return {
      ok: false,
      reason: "No training job runs until the footage source is documented. Cleared inputs are a signed agency agreement or a synthetic render pipeline you own.",
    };
  }
  if (source.kind === "stock-ai-license") {
    if (input.phase === 2) {
      return { ok: false, reason: "Stock footage is not a Custom Labels input. It stays a lead until a training contract, and that contract is a later phase." };
    }
    if (!source.contractSigned || !source.trainingRights) {
      return { ok: false, reason: "Getty and Shutterstock stay leads until a contract states AI training rights, not only editorial rights. No job was submitted." };
    }
    return { ok: true };
  }
  if (source.kind === "agency-dua") {
    if (!source.agreementId.trim() || !source.lineageRecorded || !source.restrictedBucket || !source.facesBlurredBeforeExport) {
      return {
        ok: false,
        reason: "Agency footage needs a signed agreement, a written lineage, a restricted store, and faces blurred before any clip leaves the agency. No job was submitted.",
      };
    }
    return { ok: true };
  }
  if (!source.labeledAtGeneration || source.partition !== "synthetic") {
    return {
      ok: false,
      reason: "Owned synthetic frames must be labeled when they are rendered and kept in the synthetic partition. No job was submitted.",
    };
  }
  return { ok: true };
}
