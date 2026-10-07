import type { ScheduledHandler } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { env } from "../../lib/env.js";
import { CadIntegrationRepository } from "../../repositories/cadIntegrationRepository.js";

const integrationRepo = new CadIntegrationRepository();
const sns = new SNSClient({ region: env.region });

function sinceIso(last: string | undefined): string {
  if (last && Date.parse(last)) return last;
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export const handler: ScheduledHandler = async () => {
  if (!env.cadIntegrationsTable || !env.cadWebhookIngressTopicArn) {
    console.log(JSON.stringify({ type: "cad.poller.skip", reason: "unconfigured" }));
    return;
  }

  const rows = await integrationRepo.listActiveApiPollIntegrations(80);
  if (rows.length === 0) {
    console.log(JSON.stringify({ type: "cad.poller.tick", integrations: 0 }));
    return;
  }

  for (const row of rows) {
    const cfg = row.config ?? {};
    const apiUrl = typeof cfg.apiUrl === "string" ? cfg.apiUrl.trim() : "";
    const apiKey = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";
    const agencyCode = typeof cfg.agencyCode === "string" ? cfg.agencyCode.trim() : "";
    const since = sinceIso(row.lastIncidentAt);
    try {
      if (env.cadPollerMock) {
        console.log(
          JSON.stringify({
            type: "cad.poller.mock",
            integrationId: row.id,
            agencyId: row.agencyId,
            vendor: row.vendor,
            since,
          }),
        );
        continue;
      }
      if (row.vendor !== "tyler_new_world" || !apiUrl || !apiKey) {
        console.log(
          JSON.stringify({
            type: "cad.poller.unsupported_or_misconfigured",
            integrationId: row.id,
            vendor: row.vendor,
          }),
        );
        continue;
      }
      const base = apiUrl.replace(/\/$/, "");
      const u = new URL(`${base}/incidents`);
      u.searchParams.set("since", since);
      if (agencyCode) u.searchParams.set("agency", agencyCode);
      const res = await fetch(u.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        console.error(JSON.stringify({ type: "cad.poller.http_error", status: res.status, integrationId: row.id }));
        continue;
      }
      const body = (await res.json()) as unknown;
      const list = Array.isArray(body) ? body : (body as { incidents?: unknown[] }).incidents ?? [];
      const receivedAt = new Date().toISOString();
      for (const item of list) {
        const rawBody = JSON.stringify(item);
        await sns.send(
          new PublishCommand({
            TopicArn: env.cadWebhookIngressTopicArn,
            Message: JSON.stringify({
              v: 1,
              agencyId: row.agencyId,
              integrationId: row.id,
              rawBody,
              receivedAt,
              contentType: "application/json",
            }),
          }),
        );
      }
      console.log(
        JSON.stringify({
          type: "cad.poller.published",
          integrationId: row.id,
          count: list.length,
        }),
      );
    } catch (e) {
      console.error(
        JSON.stringify({
          type: "cad.poller.error",
          integrationId: row.id,
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }
};
