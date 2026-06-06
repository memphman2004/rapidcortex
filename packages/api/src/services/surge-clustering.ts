import { SURGE_CONFIG } from "rapid-cortex-shared";
import { calculateDistanceMiles, getTimeDifferenceMinutes } from "../utils/distance-calculations.js";
import { keywordsForCall } from "../utils/surge-call-keywords.js";
import type { IncomingCall, CallCluster, ClusterAssignment, ClusteringConfig } from "../types/surge-types.js";

export class SurgeClusteringEngine {
  private config: ClusteringConfig;

  constructor(config?: Partial<ClusteringConfig>) {
    this.config = {
      maxTimeWindowMinutes: config?.maxTimeWindowMinutes ?? SURGE_CONFIG.MAX_TIME_WINDOW_MINUTES,
      maxDistanceMiles: config?.maxDistanceMiles ?? SURGE_CONFIG.MAX_DISTANCE_MILES,
      minKeywordMatches: config?.minKeywordMatches ?? SURGE_CONFIG.MIN_KEYWORD_MATCHES,
      minConfidence: config?.minConfidence ?? SURGE_CONFIG.MIN_CONFIDENCE,
    };
  }

  async findMatchingCluster(
    call: IncomingCall,
    activeClusters: CallCluster[],
  ): Promise<ClusterAssignment | null> {
    const callKeywords = keywordsForCall(call.transcript, call.callType);

    let bestMatch: ClusterAssignment | null = null;
    let highestConfidence = 0;

    for (const cluster of activeClusters) {
      const score = this.calculateClusterMatch(call, cluster, callKeywords);

      if (score.confidence >= this.config.minConfidence && score.confidence > highestConfidence) {
        bestMatch = {
          clusterId: cluster.clusterId,
          confidence: score.confidence,
          matchReasons: score.reasons,
          isNewCluster: false,
        };
        highestConfidence = score.confidence;
      }
    }

    return bestMatch;
  }

  private calculateClusterMatch(
    call: IncomingCall,
    cluster: CallCluster,
    callKeywords: string[],
  ): { confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let maxScore = 0;

    maxScore += 30;
    const timeDiffMinutes = getTimeDifferenceMinutes(call.timestamp, cluster.lastCallAt);

    if (timeDiffMinutes <= this.config.maxTimeWindowMinutes) {
      score += 30;
      reasons.push(`within_${Math.round(timeDiffMinutes)}_minutes`);
    } else {
      return { confidence: 0, reasons: ["outside_time_window"] };
    }

    if (call.location && cluster.location.centroid) {
      maxScore += 30;
      const distance = calculateDistanceMiles(
        call.location.lat,
        call.location.lon,
        cluster.location.centroid[0],
        cluster.location.centroid[1],
      );

      if (distance <= this.config.maxDistanceMiles) {
        score += 30;
        reasons.push(`within_${distance.toFixed(2)}_miles`);
      } else {
        reasons.push(`distance_${distance.toFixed(2)}_miles_too_far`);
      }
    }

    maxScore += 40;
    const keywordOverlap = this.countKeywordOverlap(callKeywords, cluster.keywords);

    if (keywordOverlap >= this.config.minKeywordMatches) {
      score += Math.min(40, keywordOverlap * 10);
      reasons.push(`${keywordOverlap}_shared_keywords`);
    } else {
      return { confidence: 0, reasons: ["insufficient_keyword_match"] };
    }

    const confidence = maxScore > 0 ? score / maxScore : 0;
    return { confidence, reasons };
  }

  private countKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
    const set2 = new Set(keywords2.map((k) => k.toLowerCase()));
    return [...set1].filter((k) => set2.has(k)).length;
  }
}
