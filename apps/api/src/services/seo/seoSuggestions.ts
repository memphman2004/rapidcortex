import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../../lib/env.js";

export type SeoAiSuggestionPayload = {
  seoTitleOptions: string[];
  metaDescriptionOptions: string[];
  faqSchemaIdeas: { question: string; answer: string }[];
  blogOutline: string[];
  landingPageIdeas: string[];
  localSeoCopy: string[];
  ctaImprovements: string[];
};

const SYSTEM = `You are an SEO strategist for public safety SaaS.
Return STRICT JSON only with keys:
seoTitleOptions (string[], 3 items),
metaDescriptionOptions (string[], 3 items),
faqSchemaIdeas (array of {question, answer}, 3 items),
blogOutline (string[], 5 short bullets),
landingPageIdeas (string[], 4 bullets),
localSeoCopy (string[], 3 bullets),
ctaImprovements (string[], 3 bullets).
Do not name AI vendors/models. Keep copy factual and non-deceptive.`;

function fallbackSuggestions(url: string, keywords: string[]): SeoAiSuggestionPayload {
  const k = keywords[0]?.trim() ?? "your topic";
  return {
    seoTitleOptions: [
      `${k} | Rapid Cortex`,
      `Rapid Cortex — ${k}`,
      `${k}: secure workflows for emergency communications`,
    ],
    metaDescriptionOptions: [
      `Explore ${k} with Rapid Cortex—dispatcher-ready workflows, CJIS-minded safeguards, and integrations designed for real operations.`,
      `Learn how agencies improve clarity and QA with Rapid Cortex around ${k.toLowerCase()}, without risky overpromises.`,
      `A concise overview of ${k.toLowerCase()}—what changes operationally, what stays under agency control, and how to pilot safely.`,
    ],
    faqSchemaIdeas: [
      {
        question: `What should agencies expect when rolling out ${k}?`,
        answer:
          "Expect phased pilots, role-based access, audit trails, and measurable QA loops rather than a big-bang swap.",
      },
      {
        question: "How does Rapid Cortex handle sensitive communications data?",
        answer:
          "Use agency-scoped tenancy, least-privilege access patterns, and configurable retention aligned to policy.",
      },
      {
        question: "Does Rapid Cortex replace our CAD?",
        answer:
          "Rapid Cortex augments workflows with intelligence layers; CAD remains the system of record unless your program dictates otherwise.",
      },
    ],
    blogOutline: [
      `Define the operational problem behind ${k.toLowerCase()}`,
      "Map stakeholders (dispatch, IT, compliance, leadership)",
      "Pilot plan with KPIs and QA checkpoints",
      "Integration realities (CAD, recording, identity)",
      "Scaling safeguards and ongoing measurement",
    ],
    landingPageIdeas: [
      "Lead with outcomes dispatchers recognize (speed to clarity, fewer misses)",
      "Add proof sections: pilot metrics, supervisor QA, audit posture",
      "Include integration strip with CAD-forward framing",
      "Close with a realistic rollout timeline",
    ],
    localSeoCopy: [
      "Highlight regional deployment experience without claiming unsupported certifications.",
      "Use service-area language aligned to your actual presence and procurement motion.",
      "Encourage agencies to validate routing and governance expectations early.",
    ],
    ctaImprovements: [
      "Prefer ‘Book a workflow review’ over generic ‘Contact us’.",
      "Offer both ‘security overview’ and ‘dispatcher demo’ paths.",
      "Add secondary CTA for integration/API questions where relevant.",
    ],
  };
}

export async function generateSeoSuggestionsAi(input: {
  url: string;
  keywords?: string[];
  context?: string;
}): Promise<{ source: "model" | "rules"; payload: SeoAiSuggestionPayload }> {
  const kw = input.keywords?.filter(Boolean) ?? [];
  if (!env.seoAiSuggestionsEnabled || !env.qaBedrockModelId) {
    return { source: "rules", payload: fallbackSuggestions(input.url, kw) };
  }
  const client = new BedrockRuntimeClient({ region: env.region });
  const user = `URL: ${input.url}
Keywords: ${kw.join(", ") || "(none)"}
Extra context:\n${input.context ?? ""}`.slice(0, 12000);

  try {
    const out = await client.send(
      new ConverseCommand({
        modelId: env.qaBedrockModelId,
        system: [{ text: SYSTEM }],
        messages: [{ role: "user", content: [{ text: user }] }],
        inferenceConfig: { maxTokens: 900, temperature: 0.2 },
      }),
    );
    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start >= 0 && end > start ? text.slice(start, end + 1) : text;
    const parsed = JSON.parse(slice) as SeoAiSuggestionPayload;
    if (!parsed.seoTitleOptions?.length) throw new Error("BAD_AI_JSON");
    return { source: "model", payload: parsed };
  } catch (err) {
    if (err instanceof ThrottlingException || err instanceof ServiceUnavailableException) {
      return { source: "rules", payload: fallbackSuggestions(input.url, kw) };
    }
    return { source: "rules", payload: fallbackSuggestions(input.url, kw) };
  }
}
