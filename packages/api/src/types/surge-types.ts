export type CallType = "medical" | "fire" | "police" | "traffic" | "other";

export interface IncomingCall {
  callId: string;
  incidentId: string;
  agencyId: string;
  timestamp: string;
  location?: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  transcript: string;
  callType: CallType;
  caller: {
    phoneNumber: string;
    language: string;
  };
}

export interface ClusterAssignment {
  clusterId: string;
  confidence: number;
  matchReasons: string[];
  isNewCluster: boolean;
}

export interface CallCluster {
  clusterId: string;
  agencyId: string;
  incidentType: string;
  location: {
    centroid: [number, number];
    radiusMiles: number;
    address?: string;
  };
  calls: ClusteredCall[];
  firstCallAt: string;
  lastCallAt: string;
  callCount: number;
  confidence: number;
  status: "active" | "confirmed" | "split" | "dismissed";
  uniqueDetails: string[];
  suggestedPriority: "critical" | "high" | "medium" | "low";
  keywords: string[];
}

export interface ClusteredCall {
  callId: string;
  incidentId: string;
  timestamp: string;
  caller: string;
  transcript: string;
  uniqueInfo: string[];
  hasMedia: boolean;
  location?: { lat: number; lon: number };
}

export interface UniqueDetail {
  callId: string;
  detail: string;
  category: "hazard" | "injury" | "description" | "access" | "other";
  caller: string;
  timestamp: string;
}

export type ClusterAction =
  | { type: "confirm"; note?: string }
  | { type: "split"; callIds: string[] }
  | { type: "dismiss"; reason: string };

export interface ClusteringConfig {
  maxTimeWindowMinutes: number;
  maxDistanceMiles: number;
  minKeywordMatches: number;
  minConfidence: number;
}
