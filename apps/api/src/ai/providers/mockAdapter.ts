import { callHasWeaponSignal } from "rapid-cortex-shared";
import type { AnalysisInput } from "../provider.js";
import type { IAIProvider } from "../iaiProvider.js";

export class MockAdapter implements IAIProvider {
  readonly adapterName: string;
  readonly providerKind = "mock" as const;
  readonly model = "mock-heuristic" as const;

  constructor(opts?: { adapterName?: string }) {
    this.adapterName = opts?.adapterName ?? "mock";
  }

  async analyze(input: AnalysisInput, _options?: { signal?: AbortSignal }): Promise<unknown> {
    const text = `${input.incidentBrief ?? ""} ${input.transcript.map((segment) => segment.text).join(" ")}`.toLowerCase();

    if (text.includes("not breathing") || text.includes("chest pain")) {
      return Promise.resolve({
        category: "medical",
        urgency: "critical",
        confidence: 0.95,
        nextQuestion: "Is the patient conscious and breathing right now?",
        recommendedAction: "Escalate as critical medical and prepare CPR guidance.",
        summary: "Possible life-threatening medical event involving breathing or chest pain.",
        rationale: "Transcript includes high-risk medical phrases.",
        escalationFlag: true,
      });
    }

    if (/\bfire\b/.test(text) || text.includes("smoke")) {
      return Promise.resolve({
        category: "fire",
        urgency: "high",
        confidence: 0.92,
        nextQuestion: "Is everyone out of the building?",
        recommendedAction: "Dispatch fire response and advise evacuation if safe.",
        summary: "Reported active fire or smoke incident.",
        rationale: "Transcript indicates structure fire indicators.",
        escalationFlag: true,
      });
    }

    if (callHasWeaponSignal(text) || text.includes("hit") || text.includes("gun") || text.includes("fight")) {
      return Promise.resolve({
        category: "police",
        urgency: "high",
        confidence: 0.9,
        nextQuestion: "Is anyone injured, and is the suspect still there?",
        recommendedAction: "Escalate to law enforcement response.",
        summary: "Reported violent incident. Confirm injuries and whether the threat is still present.",
        rationale: "The call or the incident record reports a weapon or a violent act.",
        escalationFlag: true,
      });
    }

    return Promise.resolve({
      category: "unknown",
      urgency: "moderate",
      confidence: 0.67,
      nextQuestion: "Can you tell me exactly what is happening right now?",
      recommendedAction: "Continue clarification and monitor for escalation.",
      summary: "Incident remains unclear based on available transcript.",
      rationale: "Insufficient signal for high-confidence classification.",
      escalationFlag: false,
    });
  }
}
