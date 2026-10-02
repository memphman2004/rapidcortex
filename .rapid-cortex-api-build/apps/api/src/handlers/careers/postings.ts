/**
 * Public careers job postings — GET /api/careers/postings[/{slug}] (Authorizer NONE).
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { JobPostingRepository } from "../../repositories/jobPostingRepository.js";

const repo = new JobPostingRepository();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (method(event) === "OPTIONS") {
    return withCorrelationHeaders(event, { statusCode: 204, headers: CORS, body: "" });
  }
  if (method(event) !== "GET") {
    return withCorrelationHeaders(event, json({ error: "Method not allowed" }, 405));
  }
  if (!env.enableHiring) {
    return withCorrelationHeaders(event, json({ error: "Feature is not available" }, 503));
  }
  if (!env.jobPostingsTable) {
    return withCorrelationHeaders(event, json({ error: "Service unavailable" }, 500));
  }

  const slug = event.pathParameters?.slug?.trim();

  try {
    if (slug) {
      const posting = await repo.getBySlug(slug);
      if (!posting || posting.status !== "PUBLISHED") {
        return withCorrelationHeaders(event, json({ error: "Not found" }, 404));
      }
      return withCorrelationHeaders(event, json(posting));
    }

    const postings = await repo.listPublished();
    return withCorrelationHeaders(event, json({ postings }));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "careers_postings_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, json({ error: "Internal error" }, 500));
  }
};
