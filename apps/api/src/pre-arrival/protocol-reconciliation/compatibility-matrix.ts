import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { CompatibilityRule, StepCategory } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

const ALWAYS_COMPATIBLE: StepCategory[] = ["COMMUNICATION", "SCENE_SAFETY"];
const ALWAYS_INCOMPATIBLE: StepCategory[] = ["DEFIBRILLATION", "MEDICATION"];

const DEFAULT_MATRIX: Record<string, CompatibilityRule> = {
  "CHEST_PAIN::CARDIAC_ARREST": {
    compatibleCategories: ["COMMUNICATION", "SCENE_SAFETY", "POSITIONING"],
    incompatibleCategories: ["AIRWAY", "BREATHING", "CIRCULATION", "CPR", "DEFIBRILLATION", "MEDICATION"],
  },
  "CARDIAC_ARREST::CHEST_PAIN": {
    compatibleCategories: ["COMMUNICATION", "SCENE_SAFETY"],
    incompatibleCategories: ["CPR", "DEFIBRILLATION", "AIRWAY", "BREATHING", "CIRCULATION"],
  },
  "UNKNOWN_MEDICAL::CARDIAC_ARREST": {
    compatibleCategories: ["COMMUNICATION", "SCENE_SAFETY", "POSITIONING"],
    incompatibleCategories: ["AIRWAY", "BREATHING", "CIRCULATION", "CPR", "DEFIBRILLATION", "MEDICATION"],
  },
  "UNKNOWN_MEDICAL::STROKE": {
    compatibleCategories: ["COMMUNICATION", "SCENE_SAFETY", "POSITIONING"],
    incompatibleCategories: ["CPR", "DEFIBRILLATION", "BLEEDING_CONTROL", "MEDICATION"],
  },
};

const CONSERVATIVE_FALLBACK: CompatibilityRule = {
  compatibleCategories: [...ALWAYS_COMPATIBLE],
  incompatibleCategories: [...ALWAYS_INCOMPATIBLE, "CPR", "AIRWAY", "BREATHING", "CIRCULATION", "MEDICATION"],
};

export class CompatibilityMatrix {
  async resolve(
    agencyId: string,
    sourceNatureCode: string,
    targetNatureCode: string,
  ): Promise<CompatibilityRule> {
    const source = sourceNatureCode.toUpperCase();
    const target = targetNatureCode.toUpperCase();
    const key = `${source}::${target}`;

    const table = env.protocolCompatibilityTable;
    if (table) {
      for (const pk of [`AGENCY#${agencyId}::${source}`, `GLOBAL::${source}`]) {
        try {
          const r = await ddb.send(
            new GetCommand({
              TableName: table,
              Key: { pk, targetNatureCode: target },
            }),
          );
          const rule = r.Item?.rule as CompatibilityRule | undefined;
          if (rule) return rule;
        } catch {
          // soft-fail to hardcoded matrix
        }
      }
    }

    return DEFAULT_MATRIX[key] ?? CONSERVATIVE_FALLBACK;
  }

  isCompatible(rule: CompatibilityRule, category: StepCategory, stepId: string): boolean {
    if (ALWAYS_INCOMPATIBLE.includes(category)) return false;
    if (ALWAYS_COMPATIBLE.includes(category)) return true;
    if (rule.incompatibleStepIdPrefixes?.some((p) => stepId.startsWith(p))) return false;
    if (rule.compatibleStepIdPrefixes?.some((p) => stepId.startsWith(p))) return true;
    if (rule.incompatibleCategories.includes(category)) return false;
    if (rule.compatibleCategories.includes(category)) return true;
    return false; // conservative default
  }
}
