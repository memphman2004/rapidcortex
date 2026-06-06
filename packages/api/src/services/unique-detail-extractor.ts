import type { CallCluster, UniqueDetail } from "../types/surge-types.js";

export class UniqueDetailExtractor {
  extractUniqueDetails(cluster: CallCluster): UniqueDetail[] {
    const allTranscripts = cluster.calls.map((c) => c.transcript.toLowerCase());
    const uniqueDetails: UniqueDetail[] = [];

    for (let i = 0; i < cluster.calls.length; i++) {
      const call = cluster.calls[i]!;
      const otherTranscripts = allTranscripts.filter((_, idx) => idx !== i);

      const sentences = this.extractSentences(call.transcript);

      for (const sentence of sentences) {
        const isCritical = this.isCriticalInfo(sentence);
        const isUnique = this.isUniqueToCaller(sentence, otherTranscripts);

        if (isCritical && isUnique) {
          uniqueDetails.push({
            callId: call.callId,
            detail: sentence.trim(),
            category: this.categorizeDetail(sentence),
            caller: call.caller,
            timestamp: call.timestamp,
          });
        }
      }
    }

    return uniqueDetails;
  }

  private extractSentences(transcript: string): string[] {
    return transcript
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  private isCriticalInfo(sentence: string): boolean {
    const criticalPatterns = [
      /injur/i,
      /hurt/i,
      /bleed/i,
      /unconscious/i,
      /trapped/i,
      /stuck/i,
      /fire/i,
      /smoke/i,
      /leak/i,
      /spill/i,
      /gas/i,
      /weapon/i,
      /gun/i,
      /knife/i,
      /can't get/i,
      /blocked/i,
      /locked/i,
      /child/i,
      /kid/i,
      /baby/i,
      /elderly/i,
      /not breathing/i,
      /chest pain/i,
      /heart/i,
      /seizure/i,
    ];

    return criticalPatterns.some((pattern) => pattern.test(sentence));
  }

  private isUniqueToCaller(sentence: string, otherTranscripts: string[]): boolean {
    const lower = sentence.toLowerCase();

    for (const other of otherTranscripts) {
      const similarity = this.calculateSentenceSimilarity(lower, other);
      if (similarity > 0.7) return false;
    }

    return true;
  }

  private calculateSentenceSimilarity(sentence: string, transcript: string): number {
    const words1 = new Set(sentence.split(/\s+/).filter((w) => w.length > 3));
    const words2 = new Set(transcript.split(/\s+/).filter((w) => w.length > 3));

    const intersection = [...words1].filter((w) => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  private categorizeDetail(sentence: string): UniqueDetail["category"] {
    const lower = sentence.toLowerCase();

    if (/injur|hurt|bleed|unconscious|trapped/.test(lower)) return "injury";
    if (/fire|smoke|leak|spill|weapon/.test(lower)) return "hazard";
    if (/can't|block|access|locked/.test(lower)) return "access";

    return "other";
  }
}
