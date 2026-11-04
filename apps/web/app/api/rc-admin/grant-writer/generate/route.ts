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
import { canAccessGrantSuccessProgram } from "rapid-cortex-shared";
import { buildProfileGrantNarrative, fillEmptyGrantNarrative } from "@/lib/grants/profile-narrative";
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

function factRow(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: value || "—", size: 20 }),
    ],
    spacing: { before: 80, after: 80 },
  });
}

function formText(form: Record<string, unknown>, key: string): string {
  const value = form[key];
  return typeof value === "string" ? value.trim() : "";
}

function formModules(form: Record<string, unknown>): string {
  if (!Array.isArray(form.rcModules)) return "";
  return form.rcModules
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join("; ");
}

/** Prefer a readable deadline in the Word profile (ISO dates from the wizard). */
function formatDeadlineForDoc(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return trimmed;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildDocx(
  form: Record<string, unknown>,
  sections: GrantSections,
  source: "model" | "profile",
): Document {
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
  const location = [formText(form, "agencyCity"), formText(form, "agencyState")]
    .filter(Boolean)
    .join(", ");
  const contactBits = [
    formText(form, "contactName"),
    formText(form, "contactTitle") ? `(${formText(form, "contactTitle")})` : "",
    formText(form, "contactEmail"),
  ]
    .filter(Boolean)
    .join(" ");
  const hasBudget = Boolean(formText(form, "requestedAmount"));
  const sectionChildren = [
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
      children: [new TextRun({ text: `Grant Program: ${grantName}`, size: 22, color: "444444" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
    }),
    ...(hasBudget
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `Amount Requested: ${formText(form, "requestedAmount")}`,
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

    h1("Application Profile"),
    new Paragraph({
      children: [
        new TextRun({
          text: "Facts entered in the Grant Success Program wizard. Verify every field before submission.",
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
      spacing: { after: 200 },
    }),
    factRow("Agency", agencyName),
    factRow("Agency type", formText(form, "agencyType")),
    factRow("Location", location),
    factRow("Service population", formText(form, "agencyPopulation")),
    factRow("Primary contact", contactBits),
    factRow("Grant program", grantName),
    factRow("Funding agency", formText(form, "fundingAgency")),
    factRow("Solicitation / opportunity number", formText(form, "grantNumber")),
    factRow("Amount requested", formText(form, "requestedAmount")),
    factRow("Project period", formText(form, "projectPeriod")),
    factRow("Deadline", formatDeadlineForDoc(formText(form, "deadline"))),
    factRow("Project title", projectTitle),
    factRow("Existing technology", formText(form, "existingTechnology")),
    factRow("Staffing challenge", formText(form, "staffingChallenge")),
    factRow("NexCort iQ modules", formModules(form)),
    ...(formText(form, "problemStatement")
      ? [h1("Problem statement (from application)"), ...body(formText(form, "problemStatement"))]
      : []),
    ...(formText(form, "projectDescription")
      ? [h1("Project description (from application)"), ...body(formText(form, "projectDescription"))]
      : []),
    ...(formText(form, "additionalContext")
      ? [h1("Additional context (from application)"), ...body(formText(form, "additionalContext"))]
      : []),

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
    ...(hasBudget ? [h1("VIII. Budget Narrative"), ...body(sections.budgetNarrative)] : []),
    h1(hasBudget ? "IX. Sustainability Plan" : "VIII. Sustainability Plan"),
    ...body(sections.sustainabilityPlan),
    h1(hasBudget ? "X. Conclusion" : "IX. Conclusion"),
    ...body(sections.conclusion),

    new Paragraph({
      children: [
        new TextRun({
          text:
            source === "profile"
              ? "\n\n---\nThis package was assembled from the application profile because the writing service was unavailable. Review every section and replace any general language before submission. NexCort iQ Grant Success Program."
              : "\n\n---\nReview all content for accuracy before submission. This narrative was generated by the NexCort iQ Grant Success Program.",
          size: 16,
          color: "999999",
          italics: true,
        }),
      ],
      spacing: { before: 600 },
    }),
  ];

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
        children: sectionChildren,
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessGrantSuccessProgram(user.role) || !isGrantSuccessProgramUiEnabled()) {
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
          message: "Writing the grant narrative…",
          step: 1,
          total: 3,
        });

        let sections = buildProfileGrantNarrative(form);
        let source: "model" | "profile" = "profile";
        if (canInvokeGrantWriterLambda()) {
          const invoked = await invokeGrantWriterLambda(req, JSON.stringify(form));
          rotated = invoked.rotated;
          if (invoked.ok) {
            sections = fillEmptyGrantNarrative(normalizeSections(invoked.sections), form);
            source = invoked.source;
          } else {
            console.error("[grant-writer] using profile narrative:", invoked.error);
          }
        } else {
          console.error("[grant-writer] GRANT_WRITER_FUNCTION_NAME is unset; using profile narrative");
        }

        send("progress", {
          message: source === "profile" ? "Building the package from this application…" : "Narrative complete — building Word document…",
          step: 2,
          total: 3,
        });

        send("progress", { message: "Formatting document…", step: 3, total: 3 });

        const doc = buildDocx(form, sections, source);
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

        send("complete", { base64, filename, source });
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
