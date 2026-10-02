import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  callAssistPromptProposalDecisionSchema,
  callAssistPromptProposeBodySchema,
  callAssistTransferOutcomeBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import type { Permission } from "rapid-cortex-security";
import { AuthorizationService } from "rapid-cortex-security";
import { badRequest, badRequestFromZod, notFound, ok } from "../../lib/response.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { callAssistStore } from "../../call-assist/store.js";
import { closeOpenTransferAttempts } from "../../call-assist/transfer-ledger.js";
import { decidePromptProposal, proposePromptFromQa } from "../../call-assist/prompt-cms.js";

const authz = new AuthorizationService();

function requirePerm(user: UserContext, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw new Error("FORBIDDEN");
  }
}

export async function handleCallAssistP3(
  event: APIGatewayProxyEventV2,
  opts: {
    user: UserContext;
    agencyId: string;
    method: string;
    parts: string[];
    body: unknown;
  },
): Promise<APIGatewayProxyResultV2 | null> {
  const { user, agencyId, method, parts, body } = opts;

  if (method === "GET" && parts[0] === "sessions" && parts[2] === "transfers") {
    requirePerm(user, "call_assist.session.view");
    const session = await callAssistStore.getSession(agencyId, parts[1]);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const items = await callAssistStore.listTransfers(agencyId, parts[1]);
    return withCorrelationHeaders(event, ok({ items, lastOutcome: session.lastTransferOutcome ?? null }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "transfer-outcome") {
    requirePerm(user, "call_assist.transfer.force");
    const parsed = callAssistTransferOutcomeBodySchema.safeParse({
      ...(typeof body === "object" && body ? body : {}),
      sessionId: parts[1],
    });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const updated = await closeOpenTransferAttempts({
      agencyId,
      sessionId: parsed.data.sessionId,
      actorId: user.userId,
      outcome: parsed.data.outcome,
      failureReason: parsed.data.failureReason,
    });
    session.lastTransferOutcome = parsed.data.outcome;
    session.updatedAt = new Date().toISOString();
    await callAssistStore.putSession(session);
    return withCorrelationHeaders(event, ok({ items: updated, session }));
  }

  if (method === "GET" && parts[0] === "prompt-proposals") {
    requirePerm(user, "call_assist.prompts.manage");
    const items = await callAssistStore.listPromptProposals(agencyId);
    return withCorrelationHeaders(event, ok({ items }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "qa" && parts[3] === "propose-prompt") {
    requirePerm(user, "call_assist.qa.review");
    const parsed = callAssistPromptProposeBodySchema.safeParse({
      ...(typeof body === "object" && body ? body : {}),
      sessionId: parts[1],
    });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const proposal = await proposePromptFromQa({
      agencyId,
      sessionId: parsed.data.sessionId,
      actorId: user.userId,
      promptId: parsed.data.promptId,
      proposedBody: parsed.data.proposedBody,
      findingSummary: parsed.data.findingSummary,
    });
    return withCorrelationHeaders(event, ok({ proposal }));
  }

  if (method === "POST" && parts[0] === "prompt-proposals" && parts[2] === "decision") {
    requirePerm(user, "call_assist.prompts.manage");
    const parsed = callAssistPromptProposalDecisionSchema.safeParse({
      ...(typeof body === "object" && body ? body : {}),
      proposalId: parts[1],
    });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    try {
      const proposal = await decidePromptProposal({
        agencyId,
        proposalId: parsed.data.proposalId,
        actorId: user.userId,
        decision: parsed.data.decision,
        reviewNotes: parsed.data.reviewNotes,
      });
      return withCorrelationHeaders(event, ok({ proposal }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "PROPOSAL_NOT_FOUND") return withCorrelationHeaders(event, notFound("Proposal not found"));
      if (msg === "PROPOSAL_NOT_ACTIONABLE") {
        return withCorrelationHeaders(event, badRequest("Proposal cannot be decided in its current status"));
      }
      throw err;
    }
  }

  return null;
}
