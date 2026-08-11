import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

const TEAMS_SECRET_ARN = process.env.RAPID_IQ_TEAMS_WEBHOOK_SECRET_ARN ?? "";
const APP_BASE_URL =
  process.env.APP_PUBLIC_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  "https://app.rapidcortex.us";

let cachedWebhookUrl: string | null = null;

async function getWebhookUrl(): Promise<string> {
  if (cachedWebhookUrl) return cachedWebhookUrl;
  if (!TEAMS_SECRET_ARN) throw new Error("Teams webhook ARN not set");
  const url = await resolvePlainOrSecretArn(undefined, TEAMS_SECRET_ARN, {
    preferredField: "webhookUrl",
  });
  if (!url.trim()) throw new Error("Teams webhook URL empty");
  cachedWebhookUrl = url.trim();
  return cachedWebhookUrl;
}

export async function sendTeamsAlert(opp: {
  opportunityId: string;
  agencyName: string;
  state: string;
  opportunityScore: number;
  intentStage: string;
  estimatedDollarValue: number | null;
  tags: string[];
  aiHeadline: string;
  incumbentVendor: string | null;
}): Promise<void> {
  // Silently skip when Teams webhook is not configured (local/CI without ARN).
  if (!TEAMS_SECRET_ARN) return;

  const webhookUrl = await getWebhookUrl();
  const viewUrl = `${APP_BASE_URL}/rapid-iq?opportunity=${encodeURIComponent(opp.opportunityId)}`;

  const scoreEmoji =
    opp.opportunityScore >= 90 ? "🔴" : opp.opportunityScore >= 85 ? "🟠" : "🟡";

  const dollarText = opp.estimatedDollarValue
    ? `$${(opp.estimatedDollarValue / 1000).toFixed(0)}K`
    : "";

  const stageText: Record<string, string> = {
    awareness: "Early Signal",
    evaluation: "Active Evaluation",
    active_rfp: "RFP LIVE",
    award_imminent: "Award Imminent",
  };
  const stageLabel = stageText[opp.intentStage] ?? opp.intentStage;

  const incumbentText = opp.incumbentVendor ? ` · vs ${opp.incumbentVendor}` : "";

  // Power Automate Workflow webhook — Adaptive Card format.
  // IMPORTANT: contentUrl must be null (required by Power Automate webhook trigger).
  // The flow is: HTTP POST → Apply to each (Attachments) → Post message to channel.
  // Do not recreate the Teams channel, flow, or Secrets Manager secret — already complete.
  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `${scoreEmoji} Rapid IQ — ACT NOW`,
              weight: "Bolder",
              size: "Medium",
              color: "Attention",
            },
            {
              type: "TextBlock",
              text: opp.aiHeadline,
              wrap: true,
              weight: "Bolder",
            },
            {
              type: "FactSet",
              facts: [
                {
                  title: "Agency",
                  value: `${opp.agencyName}, ${opp.state}${incumbentText}`,
                },
                { title: "Score", value: `${opp.opportunityScore}/100` },
                { title: "Stage", value: stageLabel },
                ...(dollarText ? [{ title: "Est. Value", value: dollarText }] : []),
                { title: "Tags", value: opp.tags.join(" · ") || "—" },
              ],
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "View in Rapid IQ →",
              url: viewUrl,
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Teams webhook HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  console.log(
    JSON.stringify({
      msg: "rapid_iq_teams_alert_sent",
      agency: opp.agencyName,
      score: opp.opportunityScore,
    }),
  );
}

/** Test helper — clears cached webhook URL between unit tests. */
export function clearTeamsWebhookCacheForTests(): void {
  cachedWebhookUrl = null;
}
