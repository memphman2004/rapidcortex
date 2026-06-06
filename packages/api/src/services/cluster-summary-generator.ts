import type { CallCluster, UniqueDetail } from "../types/surge-types.js";

const CATEGORY_TAG: Record<UniqueDetail["category"], string> = {
  injury: "[INJURY]",
  hazard: "[HAZARD]",
  access: "[ACCESS]",
  description: "[DESC]",
  other: "[INFO]",
};

export class ClusterSummaryGenerator {
  generateCADNote(cluster: CallCluster, uniqueDetails: UniqueDetail[]): string {
    const lines: string[] = [];

    lines.push(`SURGE CLUSTER - ${cluster.callCount} callers reporting ${cluster.incidentType}`);
    lines.push(`Location: ${cluster.location.address || "See map"}`);
    lines.push(`Time: ${this.formatTime(cluster.firstCallAt)} - ${this.formatTime(cluster.lastCallAt)}`);
    lines.push("");

    if (uniqueDetails.length > 0) {
      lines.push("Unique details reported:");
      for (const detail of uniqueDetails) {
        const icon = CATEGORY_TAG[detail.category] ?? CATEGORY_TAG.other;
        lines.push(`${icon} ${detail.detail}`);
      }
      lines.push("");
    }

    lines.push(`Keywords: ${cluster.keywords.join(", ")}`);
    lines.push(`Confidence: ${Math.round(cluster.confidence * 100)}%`);

    return lines.join("\n");
  }

  private formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
}
