/**
 * Store the next prepared still-image batch. Does not approve any image.
 * Usage: AWS_PROFILE=rapid-cortex npx tsx scripts/studio-next-batch.ts firearm_like [100|250|500|1000]
 */
import { generateStillBatch } from "../apps/web/lib/rapid-vision/studio-batch-generate";
import { isBatchSize } from "../apps/web/lib/rapid-vision/studio-batch";

async function main(): Promise<void> {
  const category = process.argv[2] || "firearm_like";
  const requested = Number(process.argv[3] ?? "");
  const batchSize = isBatchSize(requested) ? requested : undefined;
  const result = await generateStillBatch({ category, reviewer: "studio-batch-script", batchSize });
  console.log(JSON.stringify({ category, ...result, approved: false, trainingStarted: false, liveDetection: "disabled" }, null, 2));
  if (result.stored.length === 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The batch was not stored.";
  console.error(message);
  process.exitCode = 1;
});
