/**
 * Suggested Scene Monitoring policies by vertical.
 * A policy chooses how a person reviews a possible event. It does not turn a
 * detector on, decide that a crime occurred, or create a CAD incident.
 */

export const SCENE_VERTICALS = [
  { id: "campus", label: "Campus", place: "University campus" },
  { id: "venue", label: "Venue", place: "Stadium or venue" },
  { id: "psap", label: "PSAP", place: "Public safety operations center" },
  { id: "transit", label: "Transit", place: "Transit station" },
] as const;

export type SceneVertical = (typeof SCENE_VERTICALS)[number]["id"];

export const OPERATOR_HANDLING = [
  { id: "priority_review", label: "Priority review", pulse: true },
  { id: "review_alert", label: "Review alert", pulse: false },
  { id: "low_priority", label: "Low-priority review", pulse: false },
  { id: "health_only", label: "Camera health only", pulse: false },
] as const;

export type OperatorHandling = (typeof OPERATOR_HANDLING)[number]["id"];

export type SceneRuleGroup =
  | "Person safety"
  | "Violence"
  | "Possible weapon"
  | "Access"
  | "Traffic and guideway"
  | "Crowd"
  | "Environment"
  | "Camera health";

export type SceneRule = {
  id: string;
  group: SceneRuleGroup;
  scenario: string;
  /** Why the same scene is not treated the same in every place. */
  context: string;
};

export const SCENE_RULES: SceneRule[] = [
  { id: "person_down_public", group: "Person safety", scenario: "Possible person down in a public area", context: "A person low to the ground on a sidewalk, plaza, platform, or concourse. Not a medical diagnosis." },
  { id: "person_down_athletic", group: "Person safety", scenario: "Person on the ground in a gym, court, or field of play", context: "Expected during scheduled activity. Unexpected after hours or when the person stays down." },
  { id: "possible_fall", group: "Person safety", scenario: "Possible fall", context: "An apparent fall outside an athletic play surface." },
  { id: "person_down_hazard", group: "Person safety", scenario: "Person down in a pool, roadway, or platform edge", context: "The location is the hazard, not a guess about injury." },
  { id: "person_needs_assistance", group: "Person safety", scenario: "Person apparently needing assistance", context: "Unverified. Presence alone is not intent or a medical finding." },
  { id: "altercation", group: "Violence", scenario: "Potential altercation", context: "Apparent physical struggle. Not a finding that a crime occurred." },
  { id: "repeated_striking", group: "Violence", scenario: "Repeated striking or aggressive contact", context: "Needs more than one frame. A single motion is not enough." },
  { id: "weapon_like", group: "Possible weapon", scenario: "Possible weapon-like object", context: "A visible firearm-like shape. It is not a verified threat, and an officer's own firearm is not treated as a suspected crime." },
  { id: "restricted_entry", group: "Access", scenario: "Restricted-area or restricted-building entry", context: "Only inside a drawn restricted zone, during the hours that zone is closed to the public." },
  { id: "after_hours_entry", group: "Access", scenario: "After-hours entry to a secured building", context: "Uses the camera schedule. Daytime access to a public door is not this rule." },
  { id: "forced_door", group: "Access", scenario: "Door forced open, with a supporting sensor", context: "Requires the door sensor or a second camera. Video alone does not assert a break-in." },
  { id: "after_hours_parking", group: "Access", scenario: "After-hours parking activity", context: "A vehicle or person in a lot outside posted hours. Often a low-priority campus check." },
  { id: "loading_dock", group: "Access", scenario: "Service or loading area after hours", context: "Staff activity can be normal. The zone schedule decides." },
  { id: "vehicle_collision", group: "Traffic and guideway", scenario: "Possible collision", context: "Two vehicles, or a vehicle and a fixed object, in a travel way the agency monitors." },
  { id: "vehicle_stopped", group: "Traffic and guideway", scenario: "Vehicle stopped in a hazardous location", context: "Travel lane, fire lane, track foul, or platform edge. A parked stall is not this rule." },
  { id: "roadway_obstruction", group: "Traffic and guideway", scenario: "Roadway or guideway obstruction", context: "Debris, a stopped vehicle, or a blockage of the traveled path." },
  { id: "person_in_roadway", group: "Traffic and guideway", scenario: "Person in a travel lane", context: "A lane the agency has marked. A sidewalk is not a travel lane." },
  { id: "person_in_track", group: "Traffic and guideway", scenario: "Person in a restricted track or guideway", context: "The track zone itself. This is not the same event as a person on a gym floor." },
  { id: "crowd_congestion", group: "Crowd", scenario: "Crowd congestion", context: "Density in a drawn zone. A full stadium bowl during a scheduled event is not automatically congestion." },
  { id: "platform_congestion", group: "Crowd", scenario: "Platform crowd congestion", context: "The platform zone only. A concourse queue can be a lower concern than the platform edge." },
  { id: "unsafe_crowd_movement", group: "Crowd", scenario: "Unsafe crowd movement", context: "A surge toward an exit, gate, or platform edge. Not a count of how many people are present." },
  { id: "obstructed_exit", group: "Crowd", scenario: "Emergency exit or emergency-access obstruction", context: "The drawn exit, stair, vomitory, or fire lane. A line at a concession is not an exit." },
  { id: "smoke_or_flame", group: "Environment", scenario: "Visible smoke or flame-like condition", context: "A scheduled effect in a venue can be excepted. An unscheduled condition is not." },
  { id: "scheduled_effect", group: "Environment", scenario: "Scheduled smoke, flame, or crowd effect", context: "Only when the venue marks that window. Outside the window this stays a priority concern." },
  { id: "water_accumulation", group: "Environment", scenario: "Significant water accumulation", context: "Standing water in a traveled or electrical area. A wet sidewalk sheen is not enough." },
  { id: "camera_obstruction", group: "Camera health", scenario: "Camera obstruction or tampering indicator", context: "A camera-health warning. It is not a crime alert and it does not pulse red." },
  { id: "visibility_loss", group: "Camera health", scenario: "Major visibility loss", context: "The camera can no longer see the zone. That is not an all-clear." },
];

type Matrix = Record<SceneRule["id"], OperatorHandling>;

const campus: Matrix = {
  person_down_public: "review_alert",
  person_down_athletic: "low_priority",
  possible_fall: "review_alert",
  person_down_hazard: "priority_review",
  person_needs_assistance: "review_alert",
  altercation: "priority_review",
  repeated_striking: "priority_review",
  weapon_like: "priority_review",
  restricted_entry: "review_alert",
  after_hours_entry: "review_alert",
  forced_door: "priority_review",
  after_hours_parking: "low_priority",
  loading_dock: "low_priority",
  vehicle_collision: "review_alert",
  vehicle_stopped: "review_alert",
  roadway_obstruction: "review_alert",
  person_in_roadway: "review_alert",
  person_in_track: "priority_review",
  crowd_congestion: "review_alert",
  platform_congestion: "review_alert",
  unsafe_crowd_movement: "priority_review",
  obstructed_exit: "priority_review",
  smoke_or_flame: "priority_review",
  scheduled_effect: "low_priority",
  water_accumulation: "review_alert",
  camera_obstruction: "health_only",
  visibility_loss: "health_only",
};

const venue: Matrix = {
  ...campus,
  person_down_athletic: "low_priority",
  restricted_entry: "review_alert",
  after_hours_entry: "review_alert",
  after_hours_parking: "review_alert",
  loading_dock: "review_alert",
  crowd_congestion: "review_alert",
  platform_congestion: "review_alert",
  obstructed_exit: "priority_review",
  scheduled_effect: "low_priority",
  smoke_or_flame: "priority_review",
  person_in_track: "priority_review",
  vehicle_collision: "review_alert",
};

const psap: Matrix = {
  ...campus,
  person_down_public: "review_alert",
  person_down_athletic: "review_alert",
  possible_fall: "review_alert",
  after_hours_parking: "review_alert",
  loading_dock: "review_alert",
  vehicle_collision: "review_alert",
  roadway_obstruction: "review_alert",
  person_in_roadway: "priority_review",
  person_in_track: "priority_review",
  crowd_congestion: "review_alert",
  platform_congestion: "review_alert",
  scheduled_effect: "priority_review",
  smoke_or_flame: "priority_review",
  obstructed_exit: "priority_review",
};

const transit: Matrix = {
  ...campus,
  person_down_public: "review_alert",
  person_down_athletic: "review_alert",
  person_down_hazard: "priority_review",
  after_hours_parking: "review_alert",
  loading_dock: "review_alert",
  vehicle_collision: "review_alert",
  vehicle_stopped: "priority_review",
  person_in_track: "priority_review",
  person_in_roadway: "priority_review",
  crowd_congestion: "review_alert",
  platform_congestion: "review_alert",
  obstructed_exit: "priority_review",
  scheduled_effect: "priority_review",
  roadway_obstruction: "priority_review",
};

export const SUGGESTED_SCENE_POLICIES: Record<SceneVertical, Matrix> = {
  campus,
  venue,
  psap,
  transit,
};

export function handlingLabel(handling: OperatorHandling): string {
  return OPERATOR_HANDLING.find((item) => item.id === handling)?.label ?? handling;
}

/** Priority review is the only policy that can pulse the watch desk. */
export function handlingPulsesWatchDesk(handling: OperatorHandling): boolean {
  return handling === "priority_review";
}

export function suggestedHandling(vertical: SceneVertical, ruleId: string): OperatorHandling {
  const matrix = SUGGESTED_SCENE_POLICIES[vertical];
  return matrix[ruleId] ?? "review_alert";
}

export type ScenePolicyOverrides = Partial<Record<SceneVertical, Partial<Record<string, OperatorHandling>>>>;

export function resolveHandling(
  vertical: SceneVertical,
  ruleId: string,
  overrides?: ScenePolicyOverrides,
): OperatorHandling {
  return overrides?.[vertical]?.[ruleId] ?? suggestedHandling(vertical, ruleId);
}
