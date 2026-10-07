import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ZodError, type ZodSchema } from "zod";

export function parseBody<T>(event: APIGatewayProxyEventV2, schema: ZodSchema<T>): T {
  const body = event.body ? JSON.parse(event.body) : {};
  return schema.parse(body);
}

export function parsePathParam(event: APIGatewayProxyEventV2, key: string): string {
  const value = event.pathParameters?.[key];

  if (!value) {
    throw new Error(`Missing path parameter: ${key}`);
  }

  return value;
}

export function mapValidationError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      message: "Validation failed",
      issues: error.issues,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unexpected error",
  };
}
