// POST /api/rc-admin/grant-writer/generate
//
// Streams Claude grant generation to the client via SSE (POST only).
// Keepalives + X-Accel-Buffering: no keep ALB/CloudFront from treating the
// connection as idle while Claude writes.

import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";
import type { CognitoRefreshTokens } from "@/lib/auth/cognito-refresh";
import { applyRotatedAuthCookies } from "@/lib/server/bff-auth-token";
import { canInvokeGrantWriterLambda, invokeGrantWriterLambda } from "@/lib/server/grant-writer-invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const BULLET_REF = "grant-writer-bullets";

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}


interface GrantSections {
  executiveSummary: string;
  statementOfNeed: string;
  projectDescription: string;
  goalsAndObjectives: string[];
  implementationTimeline: string[];
  evaluationPlan: string;
  organizationalCapacity: string;
  budgetNarrative: string;
  sustainabilityPlan: string;
  conclusion: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function normalizeSections(raw: Record<string, unknown>): GrantSections {
  return {
    executiveSummary: String(raw.executiveSummary ?? ""),
    statementOfNeed: String(raw.statementOfNeed ?? ""),
    projectDescription: String(raw.projectDescription ?? ""),
    goalsAndObjectives: asStringArray(raw.goalsAndObjectives),
    implementationTimeline: asStringArray(raw.implementationTimeline),
    evaluationPlan: String(raw.evaluationPlan ?? ""),
    organizationalCapacity: String(raw.organizationalCapacity ?? ""),
    budgetNarrative: String(raw.budgetNarrative ?? ""),
    sustainabilityPlan: String(raw.sustainabilityPlan ?? ""),
    conclusion: String(raw.conclusion ?? ""),
  };
}

function h1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}

function body(text: string): Paragraph[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        new Paragraph({
          children: [new TextRun({ text: p })],
          spacing: { before: 120, after: 120 },
        }),
    );
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    numbering: { reference: BULLET_REF, level: 0 },
    spacing: { before: 60, after: 60 },
  });
}

function buildDocx(form: Record<string, unknown>, sections: GrantSections): Document {
  const agencyName = String(form.agencyName || "Applicant Agency");
  const grantName = String(form.grantName || "Grant Application");
  const projectTitle = String(
    form.projectTitle || "AI-Powered Public Safety Communications System",
  );
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new Document({
    title: `${grantName} — ${agencyName}`,
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: agencyName, bold: true, size: 36, color: "1A3A6B" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 1440, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: projectTitle, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Grant Program: ${grantName}`, size: 22, color: "444444" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
          }),
          ...(form.requestedAmount
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Amount Requested: ${form.requestedAmount}`,
                      size: 22,
                      color: "444444",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80, after: 80 },
                }),
              ]
            : []),
          new Paragraph({
            children: [
              new TextRun({ text: `Prepared: ${today}`, size: 18, color: "888888", italics: true }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 2880 },
          }),
          new Paragraph({ children: [new PageBreak()] }),

          h1("I. Executive Summary"),
          ...body(sections.executiveSummary),
          h1("II. Statement of Need"),
          ...body(sections.statementOfNeed),
          h1("III. Project Description"),
          ...body(sections.projectDescription),
          h1("IV. Goals and Objectives"),
          ...sections.goalsAndObjectives.map((g) => bullet(g)),
          h1("V. Implementation Timeline"),
          ...sections.implementationTimeline.map((t) => bullet(t)),
          h1("VI. Evaluation Plan"),
          ...body(sections.evaluationPlan),
          h1("VII. Organizational Capacity"),
          ...body(sections.organizationalCapacity),
          ...(form.requestedAmount
            ? [h1("VIII. Budget Narrative"), ...body(sections.budgetNarrative)]
            : []),
          h1("IX. Sustainability Plan"),
          ...body(sections.sustainabilityPlan),
          h1("X. Conclusion"),
          ...body(sections.conclusion),

          new Paragraph({
            children: [
              new TextRun({
                text: "\n\n---\nReview all content for accuracy before submission. This narrative was generated by the Rapid Cortex Grant Success Program.",
                size: 16,
                color: "999999",
                italics: true,
              }),
            ],
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) ||
    !isGrantSuccessProgramUiEnabled()
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: Record<string, unknown>;
  try {
    form = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!form.agencyName || !form.projectDescription) {
    return new Response(
      sseEvent("error", { message: "Agency name and project description are required." }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!canInvokeGrantWriterLambda()) {
    return NextResponse.json(
      { error: "Grant writer Lambda is not configured. Redeploy web after AppSam3 GrantWriterHttpFunction lands." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  let rotated: CognitoRefreshTokens | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: unknown) {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      }
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* closed */
        }
      }, 2000);

      try {
        send("progress", {
          message: "Sending to Claude — writing grant narrative…",
          step: 1,
          total: 3,
        });

        const invoked = await invokeGrantWriterLambda(req, JSON.stringify(form));
        rotated = invoked.rotated;
        if (!invoked.ok) {
          throw new Error(invoked.error);
        }

        send("progress", {
          message: "Narrative complete — building Word document…",
          step: 2,
          total: 3,
        });

        const sections = normalizeSections(invoked.sections);

        send("progress", { message: "Formatting document…", step: 3, total: 3 });

        const doc = buildDocx(form, sections);
        const buffer = await Packer.toBuffer(doc);
        const base64 = buffer.toString("base64");

        const agencySlug = String(form.agencyName || "agency")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 40);
        const grantSlug = String(form.grantName || "grant")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 30);
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `${agencySlug}-${grantSlug}-${dateStr}.docx`;

        send("complete", { base64, filename });
      } catch (err) {
        const message = (err as Error).message ?? "Unknown error";
        console.error("[grant-writer]", message);
        send("error", {
          message: message.includes("GRANT_WRITER") || message.includes("not configured")
            ? "Grant writer is not configured. Contact your RC administrator."
            : message,
        });
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  if (rotated) applyRotatedAuthCookies(response, rotated);
  return response;
}
