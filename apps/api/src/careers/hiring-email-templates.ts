/**
 * hiring-email-templates.ts
 *
 * HTML + plain-text email templates for all automated hiring communications.
 * Called by update-application-lambda.ts on status changes.
 *
 * All HTML emails use inline styles for maximum email client compatibility.
 */

export interface EmailTemplateInput {
  firstName: string;
  lastName: string;
  email: string;
  position: string;           // e.g. "Executive Assistant / Startup Operations Coordinator"
  schedulingLink?: string;    // Calendly or similar — required for PHONE_SCREEN / INTERVIEW
  customMessage?: string;     // Optional reviewer-added note inserted into the email body
  reviewerName?: string;      // Name shown in interview invites ("Jeffrey Coleman")
}

// ─── Shared HTML layout ────────────────────────────────────────────────────────
function wrap(preheader: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapid Cortex</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f1f5f9;font-size:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0D1B3E;border-radius:8px 8px 0 0;padding:28px 36px;text-align:center;">
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;">RAPID CORTEX</div>
              <div style="color:#93a3c0;font-size:12px;margin-top:4px;font-style:italic;">Intelligence at the Speed of Response</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 36px;text-align:center;">
              <div style="color:#94a3b8;font-size:11px;line-height:1.6;">
                Apps on Demand LLC &nbsp;d/b/a&nbsp; <strong>Rapid Cortex</strong><br>
                <a href="https://www.rapidcortex.us" style="color:#64748b;text-decoration:none;">www.rapidcortex.us</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const P  = `style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.65;"`;
const P_MUTED = `style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.65;"`;
const DIVIDER = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">`;
const SIG = (name: string) => `<p ${P_MUTED}>${name}<br><span style="color:#94a3b8;font-size:12px;">Rapid Cortex</span></p>`;

function ctaButton(text: string, href: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#0369a1;border-radius:6px;">
          <a href="${href}"
             style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

function infoBox(content: string): string {
  return `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px 20px;margin:20px 0;font-size:14px;color:#0c4a6e;line-height:1.6;">${content}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — REJECTION
// ─────────────────────────────────────────────────────────────────────────────
export function rejectionEmail(input: EmailTemplateInput): { subject: string; html: string; text: string } {
  const { firstName, customMessage } = input;

  const html = wrap(
    "Thank you for your interest in joining Rapid Cortex.",
    `<p ${P}>Hi ${firstName},</p>
     <p ${P}>Thank you for taking the time to apply for the <strong>${input.position}</strong> role at Rapid Cortex. We genuinely appreciate your interest in our mission and the effort you put into your application.</p>
     <p ${P}>After careful review, we have decided to move forward with other candidates whose experience more closely matches what we need at this stage. This was not an easy decision — we received strong applications and yours was among them.</p>
     ${customMessage ? `<p ${P}>${customMessage}</p>` : ""}
     <p ${P}>We are a growing company and will continue to add roles as we scale. We encourage you to check back at <a href="https://www.rapidcortex.us/careers" style="color:#0369a1;">www.rapidcortex.us/careers</a> for future opportunities.</p>
     ${DIVIDER}
     <p ${P_MUTED}>We wish you the very best in your search — thank you again for your interest in Rapid Cortex.</p>
     ${SIG("The Rapid Cortex Team")}`
  );

  const text = [
    `Hi ${firstName},`,
    "",
    `Thank you for applying for the ${input.position} role at Rapid Cortex.`,
    "",
    "After careful review, we have decided to move forward with other candidates whose experience more closely matches what we need at this stage.",
    "",
    ...(customMessage ? [customMessage, ""] : []),
    "We encourage you to check back at www.rapidcortex.us/careers for future opportunities.",
    "",
    "We wish you the very best.",
    "",
    "— The Rapid Cortex Team",
    "www.rapidcortex.us",
  ].join("\n");

  return {
    subject: "Your Application to Rapid Cortex — Update",
    html,
    text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — PHONE SCREEN INVITE
// ─────────────────────────────────────────────────────────────────────────────
export function phoneScreenEmail(input: EmailTemplateInput): { subject: string; html: string; text: string } {
  const { firstName, schedulingLink, customMessage, reviewerName = "Jeffrey Coleman" } = input;
  const scheduleSection = schedulingLink
    ? ctaButton("Schedule Your Call →", schedulingLink)
    : infoBox("We will reach out shortly to coordinate a time that works for you.");

  const html = wrap(
    "We'd love to connect — you've been selected for a phone screen.",
    `<p ${P}>Hi ${firstName},</p>
     <p ${P}>Thank you for applying to Rapid Cortex. We reviewed your application for the <strong>${input.position}</strong> role, and we would love to connect for a brief introductory call.</p>
     ${infoBox(`
       <strong>📞 Phone Screen</strong><br>
       Duration: approximately 15–20 minutes<br>
       Format: phone call — no video, no preparation required<br>
       Who you'll speak with: ${reviewerName}, Founder &amp; CEO<br>
       <span style="color:#0c4a6e;font-size:13px;">We will call you at the number you provide during booking.</span>
     `)}
     <p ${P}>We just want to learn a bit more about your background and give you a chance to ask questions about the role and what we are building at Rapid Cortex.</p>
     ${customMessage ? `<p ${P}>${customMessage}</p>` : ""}
     ${scheduleSection}
     <p ${P_MUTED}>If none of the available times work, simply reply to this email and we will find something that fits your schedule.</p>
     ${DIVIDER}
     <p ${P_MUTED}>We are looking forward to connecting.</p>
     ${SIG(reviewerName)}`
  );

  const text = [
    `Hi ${firstName},`,
    "",
    `Thank you for applying for the ${input.position} role at Rapid Cortex.`,
    "",
    "We reviewed your application and would love to connect for a brief phone call — about 15–20 minutes, no video required, no preparation needed. We will call you at the number you provide when you book.",
    "",
    ...(customMessage ? [customMessage, ""] : []),
    schedulingLink
      ? `Please use the link below to schedule a time:\n${schedulingLink}`
      : "We will be in touch shortly to coordinate a time that works for you.",
    "",
    "Looking forward to connecting.",
    "",
    `— ${reviewerName}`,
    "Rapid Cortex · www.rapidcortex.us",
  ].join("\n");

  return {
    subject: "Next Step — Phone Screen with Rapid Cortex",
    html,
    text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — INTERVIEW INVITE
// ─────────────────────────────────────────────────────────────────────────────
export function interviewEmail(input: EmailTemplateInput): { subject: string; html: string; text: string } {
  const { firstName, schedulingLink, customMessage, reviewerName = "Jeffrey Coleman" } = input;
  const scheduleSection = schedulingLink
    ? ctaButton("Schedule Your Interview →", schedulingLink)
    : infoBox("We will reach out shortly with available times to coordinate your interview.");

  const html = wrap(
    "You have been selected for an interview with Rapid Cortex.",
    `<p ${P}>Hi ${firstName},</p>
     <p ${P}>We are pleased to invite you to interview for the <strong>${input.position}</strong> position at Rapid Cortex. We were impressed by your application and are excited to learn more about your experience.</p>
     ${infoBox(`
       <strong>🗓️ Interview Details</strong><br>
       Duration: approximately 30–45 minutes<br>
       Format: Microsoft Teams video call<br>
       Who you'll meet: ${reviewerName}, Founder &amp; CEO<br>
       <span style="color:#0c4a6e;font-size:13px;">A Teams meeting link will be included in your booking confirmation email.</span>
     `)}
     ${customMessage ? `<p ${P}>${customMessage}</p>` : ""}
     ${scheduleSection}
     <p ${P}>To help you prepare, here is a brief overview of what we will cover:</p>
     <ul style="margin:0 0 16px;padding-left:20px;color:#1e293b;font-size:15px;line-height:2;">
       <li>Your background and experience in relevant roles</li>
       <li>How you approach organization, prioritization, and startup environments</li>
       <li>Questions about the role, the company, and our mission</li>
     </ul>
     <p ${P_MUTED}>No formal presentation or technical preparation is required. We want this to be a genuine conversation.</p>
     <p ${P_MUTED}>If you have any questions before your interview, please reply directly to this email.</p>
     ${DIVIDER}
     <p ${P_MUTED}>We are looking forward to speaking with you.</p>
     ${SIG(reviewerName)}`
  );

  const text = [
    `Hi ${firstName},`,
    "",
    `We are pleased to invite you to interview for the ${input.position} position at Rapid Cortex.`,
    "",
    "Interview details:",
    "  Format: Microsoft Teams video call",
    "  Duration: approximately 30–45 minutes",
    "  Note: A Teams meeting link will be in your booking confirmation email.",
    `  Who you'll meet: ${reviewerName}, Founder & CEO`,
    "",
    ...(customMessage ? [customMessage, ""] : []),
    schedulingLink
      ? `Please use the link below to schedule your interview:\n${schedulingLink}`
      : "We will be in touch shortly with available times.",
    "",
    "What we will cover:",
    "  - Your background and experience",
    "  - How you approach organization and startup environments",
    "  - Questions about the role and our mission",
    "",
    "No formal preparation required.",
    "",
    `— ${reviewerName}`,
    "Rapid Cortex · www.rapidcortex.us",
  ].join("\n");

  return {
    subject: `Interview Invitation — ${input.position.split("/")[0].trim()} at Rapid Cortex`,
    html,
    text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — OFFER (optional / future)
// ─────────────────────────────────────────────────────────────────────────────
export function offerAdvanceEmail(input: EmailTemplateInput): { subject: string; html: string; text: string } {
  const { firstName, customMessage, reviewerName = "Jeffrey Coleman" } = input;

  const html = wrap(
    "Exciting news — we would like to move forward with you.",
    `<p ${P}>Hi ${firstName},</p>
     <p ${P}>We have thoroughly enjoyed getting to know you through our conversations, and we are excited to let you know that we would like to move forward with an offer for the <strong>${input.position}</strong> role at Rapid Cortex.</p>
     <p ${P}>We will be sending over the formal offer details shortly. In the meantime, please feel free to reach out with any questions.</p>
     ${customMessage ? `<p ${P}>${customMessage}</p>` : ""}
     ${DIVIDER}
     <p ${P_MUTED}>We are genuinely excited about you joining the team.</p>
     ${SIG(reviewerName)}`
  );

  const text = [
    `Hi ${firstName},`,
    "",
    `We are excited to move forward with an offer for the ${input.position} role at Rapid Cortex.`,
    "",
    "We will be sending over the formal offer details shortly.",
    "",
    ...(customMessage ? [customMessage, ""] : []),
    `— ${reviewerName}`,
    "Rapid Cortex · www.rapidcortex.us",
  ].join("\n");

  return {
    subject: "We Would Like to Move Forward — Rapid Cortex",
    html,
    text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — maps ApplicationStatus → email template function
// ─────────────────────────────────────────────────────────────────────────────
export type EmailStatus = "REJECTED" | "PHONE_SCREEN" | "INTERVIEW" | "OFFER";

export const EMAIL_TRIGGERS: Set<string> = new Set<EmailStatus>([
  "REJECTED",
  "PHONE_SCREEN",
  "INTERVIEW",
  "OFFER",
]);

export function buildEmail(
  status: string,
  input: EmailTemplateInput,
): { subject: string; html: string; text: string } | null {
  if (status === "REJECTED")    return rejectionEmail(input);
  if (status === "PHONE_SCREEN") return phoneScreenEmail(input);
  if (status === "INTERVIEW")   return interviewEmail(input);
  if (status === "OFFER")       return offerAdvanceEmail(input);
  return null;
}
