export type {
  ContactMatchType,
  ContactRoleTier,
  ConvertToLeadBody,
  IntentStage,
  MentionedEntity,
  OpportunityStatus,
  NexiQContact,
  NexiQOpportunity,
  NexiQSignal,
  NexiQSource,
  NexiQVertical,
  RapidIqContact,
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
  RapidIqVertical,
  RcProduct,
  RefreshStatus,
  SignalChatBody,
  SignalChatMessage,
  SignalType,
  TalkingPointsBody,
  UpdateOpportunityBody,
  VerificationStatus,
} from "rapid-cortex-shared";

import type { IntentStage, RapidIqVertical } from "rapid-cortex-shared";

export type NexiQVerticalFilter = RapidIqVertical | "all";
export type IntentStageFilter = IntentStage | "all";
export type StateFilter = string;

export type OpportunityListParams = {
  vertical?: RapidIqVertical;
  state?: string;
  intentStage?: IntentStage;
  search?: string;
};

export type NexiQStats = {
  opportunities: number;
  rfps: number;
  competitor: number;
  grantFunding: number;
};

/** Alias — components still import RapidIqStats during rename. */
export type RapidIqStats = NexiQStats;
