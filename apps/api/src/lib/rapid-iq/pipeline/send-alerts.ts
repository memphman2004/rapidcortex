/**
 * High-intent alert (every 6h) and weekly digest (Monday 08:00 UTC).
 * SES when from/to are configured; otherwise log-only (mock-safe).
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { displayPipelineScores, PROCUREMENT_STAGE_LABELS, resolveProcurementStage } from "rapid-cortex-shared";
import { env } from "../../env.js";
import { sesConfigurationSetFields } from "../../ses/sesConfigurationSet.js";
import { listAgencyProfiles, listAllSignals } from "./rapid-iq-pipeline-db.js";

const ses = new SESClient({});

function fromAddress(): string {
  return process.env.SES_FROM_EMAIL?.trim() || env.sesFromEmail || "noreply@rapidcortex.us";
}

function toAddresses(): string[] {
  const raw = process.env.RAPID_IQ_ALERT_TO_EMAIL?.trim() ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

async function sendOrLog(subject: string, body: string): Promise<{ sent: boolean }> {
  const to = toAddresses();
  if (to.length === 0) {
    console.log(JSON.stringify({ msg: "rapid_iq_alert_log_only", subject, body: body.slice(0, 1500) }));
    return { sent: false };
  }
  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromAddress(),
        Destination: { ToAddresses: to },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: body, Charset: "UTF-8" } },
        },
        ...sesConfigurationSetFields(),
      }),
    );
    return { sent: true };
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_alert_ses_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return { sent: false };
  }
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function sendHighIntentAlerts(): Promise<{ candidates: number; sent: boolean }> {
  const since = hoursAgoIso(6);
  const signals = (await listAllSignals(200)).filter((s) => {
    if (s.status === "dismissed") return false;
    const combined = displayPipelineScores(s).combined;
    if (combined < 70) return false;
    const created = s.processedAt ?? s.ingestedAt;
    return created >= since;
  });

  if (signals.length === 0) {
    console.log(JSON.stringify({ msg: "rapid_iq_high_intent_none" }));
    return { candidates: 0, sent: false };
  }

  const blocks = signals.slice(0, 12).map((s) => {
    const scores = displayPipelineScores(s);
    const agency = s.agencyName ?? s.jurisdiction ?? "Unknown agency";
    const stage = PROCUREMENT_STAGE_LABELS[resolveProcurementStage(s)].label;
    return [
      `${agency}${s.state ? `, ${s.state}` : ""} (Intent: ${scores.intent}, Fit: ${scores.fit})`,
      `Signal: ${s.rawTitle}`,
      `Stage: ${stage}`,
      `Source: ${s.sourceUrl}`,
      s.excerpt ? `Excerpt: "${s.excerpt}"` : "",
      `Recommended: ${s.recommendedAction ?? "Review in Rapid IQ"}`,
      "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const first = signals[0]!;
  const firstAgency = first.agencyName ?? "agency";
  const subject = `High-Intent Signal — ${firstAgency}${first.state ? `, ${first.state}` : ""} (Intent: ${displayPipelineScores(first).intent})`;
  const body = [
    `${signals.length} high-intent Rapid IQ signal(s) in the last 6 hours.`,
    "",
    ...blocks,
    "View in Rapid IQ: https://app.rapidcortex.us/rc-admin/rapid-iq",
  ].join("\n");

  const { sent } = await sendOrLog(subject, body);
  return { candidates: signals.length, sent };
}

export async function sendWeeklyDigest(): Promise<{ sent: boolean }> {
  const weekStart = daysAgoDate(7);
  const signals = (await listAllSignals(200)).filter(
    (s) => s.status !== "dismissed" && s.signalDate >= weekStart,
  );
  const high = signals.filter((s) => displayPipelineScores(s).intent >= 70);
  const rfp = signals.filter((s) => resolveProcurementStage(s) === "rfp").length;
  const funded = signals.filter((s) => {
    const st = resolveProcurementStage(s);
    return st === "budget-funded" || st === "funding-available";
  }).length;
  const planning = signals.filter((s) => resolveProcurementStage(s) === "rfi-planning").length;
  const competitor = signals.filter(
    (s) => s.sourceId === "competitor-intel" || Boolean(s.competitorName),
  );

  const profiles = await listAgencyProfiles(50);
  const newHighAgencies = profiles
    .filter((p) => p.buyingIntentScore >= 70 && p.lastSignalDate >= weekStart)
    .slice(0, 12);

  const body = [
    "RAPID IQ WEEKLY INTELLIGENCE DIGEST",
    `Week of ${weekStart} – ${new Date().toISOString().slice(0, 10)}`,
    "",
    "NEW HIGH-INTENT AGENCIES (Intent ≥ 70 this week)",
    ...(newHighAgencies.length
      ? newHighAgencies.map(
          (p) =>
            `  ${p.name}${p.state ? `, ${p.state}` : ""} — ${p.buyingIntentScore} intent / ${p.productFitScore} fit    ${p.procurementStage}`,
        )
      : ["  (none)"]),
    "",
    "TOP SIGNALS THIS WEEK",
    `  ${rfp} new RFP/solicitation signals`,
    `  ${funded} new budget/grant signals`,
    `  ${planning} new planning/meeting signals`,
    `  ${high.length} high-intent signals overall`,
    "",
    "COMPETITOR INTEL",
    ...(() => {
      const counts = new Map<string, number>();
      for (const s of competitor) {
        const name = s.competitorName ?? s.vendorNamed ?? "Unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      const rows = [...counts.entries()].slice(0, 6);
      return rows.length ? rows.map(([n, c]) => `  ${n}: ${c} signal(s)`) : ["  (none)"];
    })(),
    "",
    "View full dashboard → https://app.rapidcortex.us/rc-admin/rapid-iq",
  ].join("\n");

  const { sent } = await sendOrLog("Rapid IQ weekly intelligence digest", body);
  return { sent };
}
