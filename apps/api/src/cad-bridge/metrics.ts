import { CloudWatchClient, PutMetricDataCommand, type MetricDatum } from "@aws-sdk/client-cloudwatch";
import { CAD_BRIDGE_METRIC_NAMESPACE, type CADSlot } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const cw = new CloudWatchClient({ region: env.region });

async function put(metrics: MetricDatum[]): Promise<void> {
  if (!metrics.length) return;
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: CAD_BRIDGE_METRIC_NAMESPACE,
        MetricData: metrics,
      }),
    );
  } catch {
    // Metrics must never fail the broker path.
  }
}

export async function emitCadBridgeMetrics(opts: {
  agencyId?: string;
  cadSlot?: CADSlot;
  syncLagMs?: number;
  conflictCount?: number;
  unresolvedConflicts?: number;
  failedPublishCount?: number;
  pendingBufferSize?: number;
  bufferDepth?: number;
  cadConnected?: boolean;
  loopDetected?: number;
  replaySuccess?: number;
  replayFailed?: number;
}): Promise<void> {
  const dims = [
    ...(opts.agencyId ? [{ Name: "AgencyId", Value: opts.agencyId }] : []),
    ...(opts.cadSlot ? [{ Name: "CadSlot", Value: opts.cadSlot }] : []),
  ];
  const withDims = dims.length ? dims : undefined;
  const metrics: MetricDatum[] = [];
  const now = new Date();
  if (opts.syncLagMs !== undefined) {
    metrics.push({
      MetricName: "SyncLagMs",
      Timestamp: now,
      Unit: "Milliseconds",
      Value: opts.syncLagMs,
      Dimensions: withDims,
    });
  }
  if (opts.conflictCount !== undefined) {
    metrics.push({
      MetricName: "ConflictCount",
      Timestamp: now,
      Unit: "Count",
      Value: opts.conflictCount,
      Dimensions: withDims,
    });
  }
  if (opts.unresolvedConflicts !== undefined) {
    metrics.push({
      MetricName: "UnresolvedConflicts",
      Timestamp: now,
      Unit: "Count",
      Value: opts.unresolvedConflicts,
      Dimensions: withDims,
    });
  }
  if (opts.failedPublishCount !== undefined) {
    metrics.push({
      MetricName: "FailedPublishCount",
      Timestamp: now,
      Unit: "Count",
      Value: opts.failedPublishCount,
      Dimensions: withDims,
    });
  }
  if (opts.pendingBufferSize !== undefined) {
    metrics.push({
      MetricName: "PendingBufferSize",
      Timestamp: now,
      Unit: "Count",
      Value: opts.pendingBufferSize,
      Dimensions: withDims,
    });
  }
  if (opts.bufferDepth !== undefined) {
    metrics.push({ MetricName: "BufferDepth", Timestamp: now, Unit: "Count", Value: opts.bufferDepth });
  }
  if (opts.cadConnected !== undefined && opts.cadSlot) {
    metrics.push({
      MetricName: "CADConnectivity",
      Timestamp: now,
      Unit: "None",
      Value: opts.cadConnected ? 1 : 0,
      Dimensions: withDims,
    });
  }
  if (opts.loopDetected !== undefined) {
    metrics.push({
      MetricName: "LoopDetected",
      Timestamp: now,
      Unit: "Count",
      Value: opts.loopDetected,
      Dimensions: withDims,
    });
  }
  if (opts.replaySuccess !== undefined) {
    metrics.push({
      MetricName: "ReplaySuccess",
      Timestamp: now,
      Unit: "Count",
      Value: opts.replaySuccess,
      Dimensions: withDims,
    });
  }
  if (opts.replayFailed !== undefined) {
    metrics.push({
      MetricName: "ReplayFailed",
      Timestamp: now,
      Unit: "Count",
      Value: opts.replayFailed,
      Dimensions: withDims,
    });
  }
  await put(metrics);
}
