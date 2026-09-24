import type { UserContext } from "rapid-cortex-shared";
import {
  hasActivePaidRelationship as hasActivePaidRelationshipShared,
  hasRapidCortexDashboardAccess,
} from "rapid-cortex-shared";

type MaybeCommercialUser = UserContext & {
  isSubscriber?: boolean;
  subscriptionStatus?: string;
  planId?: string;
};

/** Back-compat name — dashboards and operational manuals gate on NexCort iQ dashboard entitlement, not API-only NexCort Lite SKUs. */
export function hasSubscriberManualAccess(user: UserContext | null | undefined): boolean {
  return hasRapidCortexDashboardAccess(user as MaybeCommercialUser);
}

/** Any billed relationship (dashboard plan, NexCort Lite, hybrid, legacy subscriber flag). */
export function hasActivePaidRelationship(user: UserContext | null | undefined): boolean {
  return hasActivePaidRelationshipShared(user as MaybeCommercialUser);
}
