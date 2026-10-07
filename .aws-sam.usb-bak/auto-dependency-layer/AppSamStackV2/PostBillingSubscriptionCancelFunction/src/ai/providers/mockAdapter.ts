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
    const text = input.transcript.map((segment) => segment.text.toLowerCase()).join(" ");

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

    if (text.includes("fire") || text.includes("smoke")) {
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

    if (text.includes("hit") || text.includes("gun") || text.includes("fight")) {
      return Promise.resolve({
        category: "police",
        urgency: "high",
        confidence: 0.9,
        nextQuestion: "Is the suspect still on scene?",
        recommendedAction: "Escalate to law enforcement response.",
        summary: "Possible violent or criminal incident.",
        rationale: "Transcript contains violence indicators.",
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
