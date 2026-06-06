import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type {
  CallQualityTrend,
  GetQaTrendsQuery,
  QaScorecard,
  QaScorecardCategory,
  UserContext,
} from "rapid-cortex-shared";
import { PLATFORM_AGENCY_ID, QA_SCORECARD_CATEGORIES } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { QaScorecardRepository } from "../repositories/qaScorecardRepository.js";

const repo = new QaScorecardRepository();

function emptyBreakdown(): Record<QaScorecardCategory, number> {
  return {
    protocol_adherence: 0,
    communication_clarity: 0,
    information_gathering: 0,
    cad_accuracy: 0,
    call_control: 0,
    professionalism: 0,
  };
}

function periodStartFor(date: Date, period: "day" | "week" | "month"): string {
  const d = new Date(date);
  if (period === "day") {
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "week") {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function aggregateTrends(
  agencyId: string,
  cards: QaScorecard[],
  period: "day" | "week" | "month",
  dispatcherId?: string,
): CallQualityTrend[] {
  const buckets = new Map<string, { scores: number[]; cards: QaScorecard[] }>();

  for (const card of cards) {
    if (card.status === "draft") continue;
    const key = periodStartFor(new Date(card.createdAt), period);
    if (!buckets.has(key)) buckets.set(key, { scores: [], cards: [] });
    const b = buckets.get(key)!;
    b.scores.push(card.overallScore);
    b.cards.push(card);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, b]) => {
      const breakdown = emptyBreakdown();
      const counts = emptyBreakdown();
      for (const card of b.cards) {
        for (const item of card.items) {
          breakdown[item.category] += item.score;
          counts[item.category] += 1;
        }
      }
      const categoryBreakdown = { ...breakdown };
      for (const cat of QA_SCORECARD_CATEGORIES as readonly QaScorecardCategory[]) {
        categoryBreakdown[cat] =
          counts[cat] > 0 ? Math.round((breakdown[cat] / counts[cat] / 5) * 1000) / 10 : 0;
      }

      return {
        agencyId,
        dispatcherId,
        period,
        periodStart: start,
        avgScore:
          b.scores.length > 0
            ? Math.round((b.scores.reduce((s, v) => s + v, 0) / b.scores.length) * 10) / 10
            : 0,
        totalReviews: b.scores.length,
        categoryBreakdown,
      };
    });
}

export class CallQualityTrendsService {
  async trends(user: UserContext, query: GetQaTrendsQuery) {
    if (!env.qaScorecardsTable) throw new Error("QA_SCORECARDS_DISABLED");
    if (user.agencyId === PLATFORM_AGENCY_ID) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!isSupervisorOrAdmin(user.role) && user.role !== "dispatcher") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const period = query.period ?? "week";
    const weeks = query.weeks ?? 12;
    const agencyCards = await repo.listForAgency(user.agencyId, 500);
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
    const recent = agencyCards.filter((c) => new Date(c.createdAt).getTime() >= cutoff);

    const agencyTrends = aggregateTrends(user.agencyId, recent, period);

    let trends = agencyTrends;
    const dispatcherId = query.dispatcherId ?? (user.role === "dispatcher" ? user.userId : undefined);
    if (dispatcherId) {
      if (!isSupervisorOrAdmin(user.role) && user.userId !== dispatcherId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
      const dispatcherCards = recent.filter((c) => c.dispatcherId === dispatcherId);
      trends = aggregateTrends(user.agencyId, dispatcherCards, period, dispatcherId);
    }

    return { trends, agencyTrends };
  }
}
