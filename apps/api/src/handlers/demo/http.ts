import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  generateScenarioBodySchema,
  qaSuiteBodySchema,
  resetDemoBodySchema,
  runScenarioBodySchema,
  scenarioIdSchema,
  ScenarioError,
  type ScenarioId,
  type UserContext,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { DemoService } from "../../services/demoService.js";
import { generateScenarioFromPrompt } from "../../demo/ai-scenario-generator.js";
import { assertDemoMode, isScenarioApiEnabled } from "../../demo/demo-incident-guards.js";
import { runQaSuite } from "../../demo/qa-suite-runner.js";
import { resetDemoIncidents, ScenarioRunner } from "../../demo/scenario-runner.js";
import { getScenario, listScenarioCatalog } from "../../demo/scenarios/index.js";

const catalog = new DemoService();

const WRITE_ROLES = new Set(["rcsuperadmin", "rcadmin", "agencyadmin"]);

function pathOf(event: APIGatewayProxyEventV2): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function parseJson(body: string | undefined): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function canWriteScenarios(user: UserContext): boolean {
  return WRITE_ROLES.has(user.role);
}

function canTargetAgency(user: UserContext, agencyId: string): boolean {
  if (user.role === "rcsuperadmin" || user.role === "rcadmin") return true;
  return user.agencyId === agencyId;
}

function scenarioErrorResponse(err: ScenarioError): APIGatewayProxyResultV2 {
  if (err.code === "SCENARIO_API_DISABLED") return serviceUnavailable(err.message);
  return forbidden(err.message);
}

async function gateWrite(
  event: APIGatewayProxyEventV2,
): Promise<{ user: UserContext } | { response: APIGatewayProxyResultV2 }> {
  const user = await getUserContext(event);
  if (!user) return { response: unauthorized() };
  if (!isUserAccountActive(user)) return { response: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: pwd };
  if (!canWriteScenarios(user)) return { response: forbidden("Role cannot run Scenario Center") };
  if (!isScenarioApiEnabled()) {
    return { response: serviceUnavailable("ENABLE_SCENARIO_API is not 'true'") };
  }
  return { user };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = (event.requestContext.http.method ?? "GET").toUpperCase();
    const rawPath = pathOf(event);

    if (method === "GET" && /^\/api\/demo\/scenarios\/?$/.test(rawPath)) {
      const user = await getUserContext(event);
      if (!user) return withCorrelationHeaders(event, unauthorized());
      if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
      return withCorrelationHeaders(event, ok({ items: catalog.listScenarios() }));
    }

    if (method === "GET" && /^\/api\/demo\/scenario-center\/?$/.test(rawPath)) {
      const user = await getUserContext(event);
      if (!user) return withCorrelationHeaders(event, unauthorized());
      if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
      if (!canWriteScenarios(user)) return withCorrelationHeaders(event, forbidden("Role cannot view Scenario Center"));
      if (!isScenarioApiEnabled()) {
        return withCorrelationHeaders(event, serviceUnavailable("ENABLE_SCENARIO_API is not 'true'"));
      }
      return withCorrelationHeaders(event, ok({ items: listScenarioCatalog(), strategyUsed: "hybrid" }));
    }

    const runMatch = rawPath.match(/^\/api\/demo\/(?:run|scenarios)\/([^/]+)\/?$/);
    if (method === "POST" && runMatch) {
      const gated = await gateWrite(event);
      if ("response" in gated) return withCorrelationHeaders(event, gated.response);
      const idParsed = scenarioIdSchema.safeParse(decodeURIComponent(runMatch[1] ?? ""));
      if (!idParsed.success) return withCorrelationHeaders(event, notFound("Unknown scenario"));
      const body = parseJson(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = runScenarioBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canTargetAgency(gated.user, parsed.data.agencyId)) {
        return withCorrelationHeaders(event, forbidden("Cannot run scenarios for another agency"));
      }
      try {
        assertDemoMode(parsed.data.agencyId);
      } catch (err) {
        if (err instanceof ScenarioError) return withCorrelationHeaders(event, scenarioErrorResponse(err));
        throw err;
      }
      const def = getScenario(idParsed.data);
      if (!def) return withCorrelationHeaders(event, notFound("Unknown scenario"));
      const runner = new ScenarioRunner(parsed.data.agencyId, idParsed.data, gated.user);
      const result = await def.execute(parsed.data.agencyId, runner);
      return withCorrelationHeaders(event, ok(result, 201));
    }

    if (method === "POST" && /^\/api\/demo\/generate\/?$/.test(rawPath)) {
      const gated = await gateWrite(event);
      if ("response" in gated) return withCorrelationHeaders(event, gated.response);
      const body = parseJson(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = generateScenarioBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canTargetAgency(gated.user, parsed.data.agencyId)) {
        return withCorrelationHeaders(event, forbidden("Cannot run scenarios for another agency"));
      }
      try {
        assertDemoMode(parsed.data.agencyId);
      } catch (err) {
        if (err instanceof ScenarioError) return withCorrelationHeaders(event, scenarioErrorResponse(err));
        throw err;
      }
      const { definition, params } = await generateScenarioFromPrompt(
        parsed.data.situation,
        parsed.data.agencyId,
        parsed.data.vertical,
      );
      const runner = new ScenarioRunner(parsed.data.agencyId, "ai-generated" as ScenarioId, gated.user);
      const result = await definition.execute(parsed.data.agencyId, runner);
      return withCorrelationHeaders(event, ok({ result, params }, 201));
    }

    if (method === "POST" && /^\/api\/demo\/qa-suite\/?$/.test(rawPath)) {
      const gated = await gateWrite(event);
      if ("response" in gated) return withCorrelationHeaders(event, gated.response);
      const body = parseJson(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = qaSuiteBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canTargetAgency(gated.user, parsed.data.agencyId)) {
        return withCorrelationHeaders(event, forbidden("Cannot run scenarios for another agency"));
      }
      try {
        assertDemoMode(parsed.data.agencyId);
      } catch (err) {
        if (err instanceof ScenarioError) return withCorrelationHeaders(event, scenarioErrorResponse(err));
        throw err;
      }
      const report = await runQaSuite(parsed.data.agencyId, parsed.data.vertical, gated.user);
      return withCorrelationHeaders(event, ok(report));
    }

    if (method === "DELETE" && /^\/api\/demo\/reset\/?$/.test(rawPath)) {
      const gated = await gateWrite(event);
      if ("response" in gated) return withCorrelationHeaders(event, gated.response);
      const body = parseJson(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const fromQuery = event.queryStringParameters?.agencyId;
      const parsed = resetDemoBodySchema.safeParse(
        typeof body === "object" && body && "agencyId" in body ? body : { agencyId: fromQuery },
      );
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canTargetAgency(gated.user, parsed.data.agencyId)) {
        return withCorrelationHeaders(event, forbidden("Cannot reset another agency"));
      }
      try {
        assertDemoMode(parsed.data.agencyId);
      } catch (err) {
        if (err instanceof ScenarioError) return withCorrelationHeaders(event, scenarioErrorResponse(err));
        throw err;
      }
      const result = await resetDemoIncidents(parsed.data.agencyId);
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (err: unknown) {
    if (err instanceof ScenarioError) {
      return withCorrelationHeaders(event, scenarioErrorResponse(err));
    }
    console.error(JSON.stringify({ msg: "demo_http_error", error: String(err) }));
    return withCorrelationHeaders(event, serverError("Scenario Center request failed"));
  }
};
