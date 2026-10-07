export function logAiProviderFailure(providerName: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      type: "ai.provider.failure",
      provider: providerName,
      message,
      stack,
      at: new Date().toISOString(),
    }),
  );
}

export function logAiProviderChainResult(meta: {
  winner: string;
  tierIndex: number;
  usedFallback: boolean;
  usedSecondaryFallback: boolean;
  incidentId: string;
  model?: string;
  latencyMs?: number;
}): void {
  console.log(
    JSON.stringify({
      type: "ai.provider.chain.success",
      at: new Date().toISOString(),
      ...meta,
    }),
  );
}

export function logAiValidationFailure(message: string, issues: unknown): void {
  console.error(
    JSON.stringify({
      type: "ai.output.validation_failed",
      message,
      issues,
      at: new Date().toISOString(),
    }),
  );
}
