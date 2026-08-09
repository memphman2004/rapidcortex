/** Optional news collector stub — not invoked by orchestrator v1. */
export async function runNewsCollector(): Promise<{ signalsFound: number }> {
  return { signalsFound: 0 };
}
