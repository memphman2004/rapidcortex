/**
 * Still-image batches for the Model Training Studio.
 * A generated image is not approved and is not a verified training label.
 * Video and zone classes are stored as a single review frame.
 */

export const STILL_BATCH_SIZE = 10;
export const STILL_BATCH_USD = 0.4;
export const STILL_IMAGE_USD = 0.04;
export const STILL_IMAGE_MODEL = "gpt-image-2.5-flare";
export const BATCH_SIZE_CHOICES = [100, 250, 500, 1000] as const;
export const DEFAULT_BATCH_SIZE = 100;
export const GENERATION_ATTEMPT_LIMIT = 3;

export type BatchSize = (typeof BATCH_SIZE_CHOICES)[number];

export type BatchProgress = {
  requested: number;
  /** Files that passed validation and entered the unverified queue. Rejected files are not included. */
  accepted: number;
  generated: number;
  failed: number;
  qualityRejected: number;
  queued: number;
};

export function progressSummary(progress: BatchProgress): string {
  const rejected = progress.failed + progress.qualityRejected;
  return `Requested ${progress.requested}. Accepted ${progress.accepted}. Rejected ${rejected}. Failed ${progress.failed}. Quality-rejected ${progress.qualityRejected}. Queued ${progress.queued}.`;
}

/** Each provider call costs one image. A retry that would cross the cap is not sent. */
export function attemptFitsSpend(spentUsd: number, priorAttempts: number, capUsd: number): boolean {
  return spentUsd + (priorAttempts + 1) * STILL_IMAGE_USD <= capUsd;
}

export function isBatchSize(value: number): value is BatchSize {
  return (BATCH_SIZE_CHOICES as readonly number[]).includes(value);
}

export function batchEstimateUsd(count: number): number {
  return Math.round(count * STILL_IMAGE_USD * 100) / 100;
}

/** Provider retries wait 200ms, then 400ms, then 800ms. */
export function generationRetryDelayMs(attempt: number): number {
  return 200 * 2 ** Math.max(0, attempt - 1);
}

export type BatchScene = {
  id: string;
  index: string;
  role: "positive" | "negative";
  difficulty: "standard" | "challenging";
  lighting: string;
  cameraAngle: string;
  occlusion: string;
  distance: string;
  prompt: string;
};

export type BatchCategoryChoice = {
  id: string;
  name: string;
  media: "image" | "video" | "zone";
};

export const BATCH_CATEGORY_CHOICES: readonly BatchCategoryChoice[] = [
  { id: "firearm_like", name: "Firearm-like object", media: "image" },
  { id: "blade_like", name: "Knife or blade-like object", media: "image" },
  { id: "altercation", name: "Physical altercation", media: "video" },
  { id: "person_down", name: "Person down or fall", media: "video" },
  { id: "forced_entry", name: "Forced-entry indicators", media: "video" },
  { id: "vehicle_collision", name: "Vehicle collision", media: "video" },
  { id: "restricted_zone", name: "Restricted-zone entry", media: "zone" },
  { id: "blocked_exit", name: "Blocked emergency exit", media: "zone" },
  { id: "transit_hazard", name: "Hazardous transit area", media: "zone" },
  { id: "smoke_or_flame", name: "Smoke or flame-like condition", media: "image" },
];

type SceneRow = [string, "positive" | "negative", "standard" | "challenging", string, string, string, string];

const NO_PERSON = "No people, no faces, no text, and no logo.";
/** Person scenes may show synthetic faces. A real individual's likeness is not requested. */
const SYNTHETIC_PERSON = "Any person is synthetic, not a real individual, and the face may be visible. More than one person may appear. Use ordinary clothing and ordinary posture, not only a person holding a weapon. No text, no logo, and no timestamp.";

function pack(batchId: string, rows: SceneRow[], closing = NO_PERSON): BatchScene[] {
  return rows.map(([index, role, difficulty, lighting, cameraAngle, occlusion, prompt]) => ({
    id: `${batchId}-${index}`,
    index,
    role,
    difficulty,
    lighting,
    cameraAngle,
    occlusion,
    distance: "medium",
    prompt: `${prompt} ${closing}`,
  }));
}

const PREPARED_BATCHES: Record<string, { batchId: string; scenes: BatchScene[] }[]> = {
  firearm_like: [
    {
      batchId: "firearm-like-b02",
      scenes: pack("firearm-like-b02", [
        ["01", "positive", "standard", "day", "stair", "none", "Daylight security camera looking down an empty concrete stairwell. A dark pistol-like silhouette lies on a step."],
        ["02", "positive", "standard", "day", "doorway", "none", "Doorway camera in an empty office lobby, daylight. A long firearm-like silhouette leans against the wall by a closed door."],
        ["03", "positive", "standard", "day", "corridor", "none", "Corridor camera in an empty school hallway, daylight. A compact pistol-like shape sits on a windowsill."],
        ["04", "positive", "standard", "night", "overhead", "none", "Night overhead camera over an empty campus walkway. A pistol-like silhouette lies on the pavement under a lamp."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty parking garage. A black flashlight lies on the concrete."],
        ["06", "negative", "standard", "day", "doorway", "none", "Doorway camera in an empty workshop, daylight. A cordless impact driver lies on the floor."],
        ["07", "negative", "standard", "day", "corridor", "none", "Corridor camera in an empty hallway, daylight. A closed black umbrella lies on the tile."],
        ["08", "negative", "standard", "day", "loading-dock", "none", "Daylight camera on an empty loading dock. A claw hammer lies on the concrete."],
        ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead camera in an empty basement corridor. A pistol-like silhouette is partly hidden behind a laundry cart."],
        ["10", "negative", "challenging", "low", "doorway", "partial", "Low-light doorway camera in an empty stair landing. A flashlight is partly blocked by a trash bin."],
      ]),
    },
    {
      batchId: "firearm-like-b03",
      scenes: pack("firearm-like-b03", [
        ["01", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty stadium concourse. A pistol-like silhouette lies near a closed concession shutter."],
        ["02", "positive", "standard", "day", "platform", "none", "Platform camera on an empty transit platform, daylight. A long firearm-like silhouette lies along the yellow safety line. No train."],
        ["03", "positive", "standard", "day", "elevator", "none", "Camera inside an empty elevator lobby, daylight. A compact pistol-like shape rests on a bench."],
        ["04", "positive", "standard", "night", "garage", "none", "Night camera in an empty parking-garage corner. A pistol-like silhouette lies beside a painted column."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty gym hallway. A water bottle and a black remote control lie on the floor."],
        ["06", "negative", "standard", "day", "doorway", "none", "Doorway camera in an empty mail room, daylight. A staple gun lies on a table."],
        ["07", "negative", "standard", "day", "corridor", "none", "Corridor camera in an empty hospital hallway, daylight. A handheld infrared thermometer lies on a chair. No patients."],
        ["08", "negative", "standard", "night", "overhead", "none", "Night overhead camera on an empty sidewalk. A power drill lies on the pavement."],
        ["09", "positive", "challenging", "low", "doorway", "partial", "Low-light doorway camera in an empty parking stair. A pistol-like silhouette is partly behind a metal railing."],
        ["10", "negative", "challenging", "low", "overhead", "partial", "Low-light overhead camera in an empty warehouse aisle. A caulk gun is partly hidden by a pallet."],
      ]),
    },
  ],
  blade_like: [
    {
      batchId: "blade-like-b01",
      scenes: pack("blade-like-b01", [
        ["01", "positive", "standard", "day", "overhead", "none", "Overhead daylight security camera in an empty break room. A kitchen knife lies on a table."],
        ["02", "positive", "standard", "day", "corridor", "none", "Corridor camera in an empty hallway, daylight. A folding pocket knife lies open on the floor."],
        ["03", "positive", "standard", "day", "doorway", "none", "Doorway camera in an empty workshop, daylight. A box cutter lies on a workbench."],
        ["04", "positive", "standard", "night", "overhead", "none", "Night overhead camera in an empty parking garage. A knife-like silhouette lies on the concrete."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty kitchen. A metal spatula lies on the counter."],
        ["06", "negative", "standard", "day", "corridor", "none", "Corridor camera in an empty hallway, daylight. A smartphone lies face-down on the tile."],
        ["07", "negative", "standard", "day", "doorway", "none", "Doorway camera in an empty office, daylight. A pair of scissors lies closed on a desk."],
        ["08", "negative", "standard", "day", "loading-dock", "none", "Daylight camera on an empty loading dock. A paint scraper lies on the concrete."],
        ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead camera in an empty stairwell. A knife-like silhouette is partly behind a step edge."],
        ["10", "negative", "challenging", "low", "doorway", "partial", "Low-light doorway camera in an empty corridor. A closed stapler is partly blocked by a trash bin."],
      ]),
    },
    {
      batchId: "blade-like-b02",
      scenes: pack("blade-like-b02", [
        ["01", "positive", "standard", "day", "platform", "none", "Platform camera on an empty transit platform, daylight. A utility knife lies on a bench. No train."],
        ["02", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty cafeteria. A chef's knife lies on a tray."],
        ["03", "positive", "standard", "day", "corridor", "none", "Corridor camera in an empty school hallway, daylight. A box cutter lies on a windowsill."],
        ["04", "positive", "standard", "night", "doorway", "none", "Night doorway camera in an empty lobby. A knife-like silhouette lies on the floor mat."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty classroom. A metal ruler lies on a desk."],
        ["06", "negative", "standard", "day", "doorway", "none", "Doorway camera in an empty workshop, daylight. A putty knife lies on the floor."],
        ["07", "negative", "standard", "day", "corridor", "none", "Corridor camera in an empty hallway, daylight. A TV remote lies on the carpet."],
        ["08", "negative", "standard", "night", "overhead", "none", "Night overhead camera in an empty garage. A tire pressure gauge lies on the concrete."],
        ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead camera in an empty basement. A knife-like silhouette is partly under a folding chair."],
        ["10", "negative", "challenging", "low", "corridor", "partial", "Low-light corridor camera in an empty hall. A letter opener is partly behind a doorstop."],
      ]),
    },
  ],
  altercation: [
    {
      batchId: "altercation-b01",
      scenes: pack("altercation-b01", [
        ["01", "positive", "standard", "day", "corridor", "none", "Corridor security camera, daylight. Two distant figures in plain clothing are shoving each other in an empty hallway."],
        ["02", "positive", "standard", "day", "doorway", "none", "Doorway camera in an empty lobby, daylight. Two distant figures are grappling near a closed door."],
        ["03", "positive", "standard", "night", "overhead", "none", "Night overhead camera in an empty parking garage. Two distant figures are striking toward one another."],
        ["04", "positive", "standard", "day", "platform", "none", "Platform camera, daylight, no train. Two distant figures are pushing on an otherwise empty platform."],
        ["05", "negative", "standard", "day", "corridor", "none", "Corridor camera, daylight. Two distant figures are jogging side by side in an empty hallway."],
        ["06", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty gym. Two distant figures are stretching on the floor."],
        ["07", "negative", "standard", "day", "doorway", "none", "Doorway camera, daylight. Two distant figures are shaking hands in an empty lobby."],
        ["08", "negative", "standard", "night", "platform", "none", "Night platform camera, no train. Two distant figures are standing apart and talking."],
        ["09", "positive", "challenging", "low", "corridor", "partial", "Low-light corridor camera. Two distant figures are partly behind a column and appear to be grappling."],
        ["10", "negative", "challenging", "low", "overhead", "partial", "Low-light overhead camera. Two distant figures are partly hidden by a cart while exercising."],
      ], SYNTHETIC_PERSON),
    },
  ],
  person_down: [
    {
      batchId: "person-down-b01",
      scenes: pack("person-down-b01", [
        ["01", "positive", "standard", "day", "corridor", "none", "Corridor security camera, daylight. One synthetic figure is lying on the hallway floor."],
        ["02", "positive", "standard", "day", "stair", "none", "Stairwell camera, daylight. One synthetic figure is low on the steps."],
        ["03", "positive", "standard", "night", "overhead", "none", "Night overhead camera in an empty parking garage. One distant figure is lying beside a column."],
        ["04", "positive", "standard", "day", "doorway", "none", "Doorway camera in an empty lobby, daylight. One distant figure is on the floor just inside the door."],
        ["05", "negative", "standard", "day", "corridor", "none", "Corridor camera, daylight. One distant figure is sitting upright on a bench."],
        ["06", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty room. One distant figure is stretching on a mat."],
        ["07", "negative", "standard", "day", "platform", "none", "Platform camera, daylight, no train. One distant figure is standing and waiting."],
        ["08", "negative", "standard", "night", "doorway", "none", "Night doorway camera. One distant figure is kneeling to tie a shoe."],
        ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead camera. One distant figure is lying on the floor and is partly behind a trash bin."],
        ["10", "negative", "challenging", "low", "corridor", "partial", "Low-light corridor camera. One distant figure is sitting on the floor and is partly behind a door."],
      ], SYNTHETIC_PERSON),
    },
  ],
  forced_entry: [
    {
      batchId: "forced-entry-b01",
      scenes: pack("forced-entry-b01", [
        ["01", "positive", "standard", "day", "doorway", "none", "Doorway security camera, daylight. A secured door is swung inward, and the latch area looks displaced. A distant figure is in the opening."],
        ["02", "positive", "standard", "night", "doorway", "none", "Night camera on an exterior staff door. The door is open past the frame, and a distant figure is stepping through."],
        ["03", "positive", "standard", "day", "corridor", "none", "Corridor camera, daylight. A door at the end of an empty hall is forced open at an angle."],
        ["04", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty lobby. A glass door is open with the closer arm bent, and a distant figure is inside."],
        ["05", "negative", "standard", "day", "doorway", "none", "Doorway camera, daylight. A closed door with a distant figure standing still in front of it."],
        ["06", "negative", "standard", "day", "corridor", "none", "Corridor camera, daylight. An ordinary open doorway with no damage and nobody in it."],
        ["07", "negative", "standard", "night", "doorway", "none", "Night camera. A closed and latched door, empty sidewalk."],
        ["08", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera. A door held open by a normal doorstop, empty lobby."],
        ["09", "positive", "challenging", "low", "doorway", "partial", "Low-light doorway camera. A partly seen door is open at an odd angle behind a column."],
        ["10", "negative", "challenging", "low", "corridor", "partial", "Low-light corridor camera. A normal closed door is partly blocked from view by a cart."],
      ], SYNTHETIC_PERSON),
    },
  ],
  vehicle_collision: [
    {
      batchId: "vehicle-collision-b01",
      scenes: pack("vehicle-collision-b01", [
        ["01", "positive", "standard", "day", "intersection", "none", "Daylight intersection camera. Two cars are touching at the front bumpers. Two synthetic people in ordinary clothes stand beside the cars."],
        ["02", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera in a parking garage. One car is against a concrete column, and one synthetic person in ordinary clothes stands next to the driver's door."],
        ["03", "positive", "standard", "night", "intersection", "none", "Night intersection camera. Two vehicles are stopped against each other in the lane. Two synthetic people stand apart from the cars."],
        ["04", "positive", "standard", "day", "loading-dock", "none", "Daylight loading-dock camera. A van is against the dock edge, and one synthetic person in work clothes stands beside the van."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera. Several cars parked in marked spaces, not touching."],
        ["06", "negative", "standard", "day", "intersection", "none", "Daylight intersection camera. One car waiting at a red light, no other vehicle near it."],
        ["07", "negative", "standard", "night", "garage", "none", "Night parking-garage camera. Empty stalls and one parked car centered in a space."],
        ["08", "negative", "standard", "day", "loading-dock", "none", "Daylight loading dock with no vehicle. The dock edge is clear."],
        ["09", "positive", "challenging", "low", "intersection", "partial", "Low-light intersection camera. Two vehicles are partly out of frame and their bumpers meet."],
        ["10", "negative", "challenging", "low", "overhead", "partial", "Low-light overhead camera. Two parked cars are close in adjacent spaces but not touching, partly in shadow. One synthetic person walks past on the public walkway."],
      ], SYNTHETIC_PERSON),
    },
  ],
  restricted_zone: [
    {
      batchId: "restricted-zone-b01",
      scenes: pack("restricted-zone-b01", [
        ["01", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera. A red line marks a closed area, and one distant figure is stepping across the line."],
        ["02", "positive", "standard", "day", "doorway", "none", "Doorway camera, daylight. A rope barrier closes a hallway, and one distant figure is on the closed side."],
        ["03", "positive", "standard", "night", "corridor", "none", "Night corridor camera. A painted keep-out stripe, and one distant figure is beyond the stripe."],
        ["04", "positive", "standard", "day", "platform", "none", "Daylight camera at a staff-only gate. One distant figure is past the gate on the restricted side."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera. One distant figure walks on the public side of a red line and does not cross it."],
        ["06", "negative", "standard", "day", "corridor", "none", "Corridor camera, daylight. An empty closed hallway behind a barrier, nobody past it."],
        ["07", "negative", "standard", "night", "doorway", "none", "Night camera. A closed staff door and an empty public corridor."],
        ["08", "negative", "standard", "day", "platform", "none", "Daylight platform camera, no train. One distant figure stands in the public waiting area."],
        ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead camera. One distant figure is partly behind a column and is across a painted line."],
        ["10", "negative", "challenging", "low", "corridor", "partial", "Low-light corridor camera. A barrier is partly in shadow and the closed side is empty."],
      ], SYNTHETIC_PERSON),
    },
  ],
  blocked_exit: [
    {
      batchId: "blocked-exit-b01",
      scenes: pack("blocked-exit-b01", [
        ["01", "positive", "standard", "day", "doorway", "none", "Daylight camera on a marked emergency exit. A loaded cart is parked across the door."],
        ["02", "positive", "standard", "day", "stair", "none", "Stairwell camera, daylight. Boxes are stacked on the landing and block the stairs."],
        ["03", "positive", "standard", "night", "corridor", "none", "Night corridor camera. A pallet blocks a door marked as an exit."],
        ["04", "positive", "standard", "day", "loading-dock", "none", "Daylight camera on a fire lane. A van is stopped across the painted fire lane."],
        ["05", "negative", "standard", "day", "doorway", "none", "Daylight camera. A marked emergency exit door is clear, with nothing in front of it."],
        ["06", "negative", "standard", "day", "stair", "none", "Stairwell camera, daylight. The stairs and landing are empty."],
        ["07", "negative", "standard", "night", "corridor", "none", "Night corridor camera. An exit door at the end of an empty hall is unobstructed."],
        ["08", "negative", "standard", "day", "loading-dock", "none", "Daylight camera. A painted fire lane is empty."],
        ["09", "positive", "challenging", "low", "doorway", "partial", "Low-light doorway camera. A cart partly blocks an exit door and is partly in shadow."],
        ["10", "negative", "challenging", "low", "stair", "partial", "Low-light stair camera. The landing is clear, with a handrail partly shadowing the steps."],
      ]),
    },
  ],
  transit_hazard: [
    {
      batchId: "transit-hazard-b01",
      scenes: pack("transit-hazard-b01", [
        ["01", "positive", "standard", "day", "platform", "none", "Platform camera, daylight. One distant figure is standing on the yellow edge line. No train."],
        ["02", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera of an empty guideway. One distant figure is inside the marked track area."],
        ["03", "positive", "standard", "night", "platform", "none", "Night platform camera. One distant figure is past the yellow line toward the track side. No train."],
        ["04", "positive", "standard", "day", "doorway", "none", "Daylight camera at a platform end gate. One distant figure is beyond the gate on the track side."],
        ["05", "negative", "standard", "day", "platform", "none", "Platform camera, daylight, no train. One distant figure waits behind the yellow line."],
        ["06", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera. An empty platform and an empty guideway."],
        ["07", "negative", "standard", "night", "platform", "none", "Night platform camera. Empty benches and the yellow line, nobody on the edge."],
        ["08", "negative", "standard", "day", "corridor", "none", "Daylight camera in a station corridor. One distant figure walks in the public hallway, away from the platform."],
        ["09", "positive", "challenging", "low", "platform", "partial", "Low-light platform camera. One distant figure is partly behind a column and is on the track-side edge. No train."],
        ["10", "negative", "challenging", "low", "overhead", "partial", "Low-light overhead camera. The platform edge is empty and partly in shadow."],
      ], SYNTHETIC_PERSON),
    },
  ],
  smoke_or_flame: [
    {
      batchId: "smoke-or-flame-b01",
      scenes: pack("smoke-or-flame-b01", [
        ["01", "positive", "standard", "day", "corridor", "none", "Corridor security camera, daylight. Gray smoke hangs in an otherwise empty hallway."],
        ["02", "positive", "standard", "day", "overhead", "none", "Overhead daylight camera in an empty room. A small flame-like glow is on the floor with a thin smoke plume."],
        ["03", "positive", "standard", "night", "doorway", "none", "Night doorway camera. Smoke is coming from under a closed door in an empty lobby."],
        ["04", "positive", "standard", "day", "stair", "none", "Stairwell camera, daylight. Haze and smoke fill the upper landing. The stairs are empty."],
        ["05", "negative", "standard", "day", "overhead", "none", "Overhead daylight camera of an empty stage. An orange theatrical light shines on the floor, with no smoke."],
        ["06", "negative", "standard", "day", "corridor", "none", "Corridor camera, daylight. A floor vent lets out a small white steam puff in an empty hall."],
        ["07", "negative", "standard", "night", "doorway", "none", "Night doorway camera. A bright exterior lamp glows through glass. No smoke."],
        ["08", "negative", "standard", "day", "loading-dock", "none", "Daylight loading dock. Dust in a sunbeam, no flame and no smoke plume."],
        ["09", "positive", "challenging", "low", "corridor", "partial", "Low-light corridor camera. A thin smoke layer is partly hidden behind a column."],
        ["10", "negative", "challenging", "low", "overhead", "partial", "Low-light overhead camera. A reflection of a ceiling light looks warm, with no smoke."],
      ]),
    },
  ],
};

const LIGHTS = ["day", "night", "low", "overcast", "dusk"] as const;
const ANGLES = ["overhead", "doorway", "corridor", "garage", "stair", "platform", "corner", "wide"] as const;
const DISTANCES = ["close", "medium", "far"] as const;
const PLACES = ["parking lot", "office lobby", "hallway", "parking garage", "stairwell", "transit platform", "campus walkway", "loading dock", "elevator lobby", "sidewalk"] as const;
const CLOTHES = ["hoodie", "jacket", "t-shirt", "work shirt", "coat", "uniform shirt"] as const;
const POSTURES = ["walking", "standing", "turning", "crouching", "stepping", "pausing"] as const;

const CATEGORY_SUBJECT: Record<string, { positive: string; negative: string }> = {
  blade_like: {
    positive: "A knife is visible in one hand.",
    negative: "The person holds a closed pair of scissors. No knife.",
  },
  altercation: {
    positive: "Two synthetic people are shoving each other.",
    negative: "Two synthetic people are jogging side by side. They are not fighting.",
  },
  person_down: {
    positive: "One synthetic person is lying on the ground.",
    negative: "One synthetic person is sitting upright and has not fallen.",
  },
  forced_entry: {
    positive: "A door is partly forced, and one synthetic person is at the doorway.",
    negative: "One synthetic person is opening a door with a key. The door is not forced.",
  },
  vehicle_collision: {
    positive: "Two cars are touching after a collision, and synthetic people in ordinary clothes stand beside them.",
    negative: "Two cars are parked apart. One synthetic person walks past. There is no collision.",
  },
  restricted_zone: {
    positive: "One synthetic person is stepping past a closed gate into a restricted area.",
    negative: "One synthetic person is standing on the public side of a closed gate.",
  },
  blocked_exit: {
    positive: "Boxes are stacked across an emergency exit door.",
    negative: "An emergency exit door is clear and closed.",
  },
  transit_hazard: {
    positive: "A bag is left on a transit platform edge. No train.",
    negative: "An empty bench sits on a transit platform. No train and no hazard.",
  },
  smoke_or_flame: {
    positive: "A small flame and smoke are visible.",
    negative: "An orange lamp shines on the floor. There is no smoke and no flame.",
  },
};

export function sizedBatchId(category: string, size: BatchSize): string {
  if (category === "firearm_like" && size === 100) return "firearm-like-b04";
  if (category === "firearm_like") return `firearm-like-b04-${size}`;
  return `${category}-n${size}`;
}

export function firearmMix(size: number): {
  handguns: number;
  phones: number;
  flashlights: number;
  umbrellas: number;
  drills: number;
  bottles: number;
} {
  const handguns = size / 2;
  const each = Math.floor(handguns / 5);
  let extra = handguns % 5;
  const counts = [each, each, each, each, each];
  for (let index = 0; extra > 0; index += 1) {
    counts[index] = (counts[index] ?? 0) + 1;
    extra -= 1;
  }
  return {
    handguns,
    phones: counts[0] ?? 0,
    flashlights: counts[1] ?? 0,
    umbrellas: counts[2] ?? 0,
    drills: counts[3] ?? 0,
    bottles: counts[4] ?? 0,
  };
}

function sceneAxes(index: number): { lighting: string; cameraAngle: string; distance: string; place: string; clothing: string; posture: string } {
  return {
    lighting: LIGHTS[index % LIGHTS.length] ?? "day",
    cameraAngle: ANGLES[Math.floor(index / 2) % ANGLES.length] ?? "overhead",
    distance: DISTANCES[Math.floor(index / 3) % DISTANCES.length] ?? "medium",
    place: PLACES[Math.floor(index / 5) % PLACES.length] ?? "hallway",
    clothing: CLOTHES[Math.floor(index / 7) % CLOTHES.length] ?? "jacket",
    posture: POSTURES[Math.floor(index / 11) % POSTURES.length] ?? "standing",
  };
}

function sizedScene(batchId: string, index: number, role: "positive" | "negative", prompt: string): BatchScene {
  const axes = sceneAxes(index);
  const challenging = role === "negative" ? index % 2 === 1 : index % 5 === 4;
  const number = String(index + 1).padStart(4, "0");
  return {
    id: `${batchId}-${number}`,
    index: number,
    role,
    difficulty: challenging ? "challenging" : "standard",
    lighting: axes.lighting,
    cameraAngle: axes.cameraAngle,
    occlusion: challenging ? "partial" : "none",
    distance: axes.distance,
    prompt,
  };
}

function firearmScenes(size: BatchSize): BatchScene[] {
  const batchId = sizedBatchId("firearm_like", size);
  const mix = firearmMix(size);
  const rows: { role: "positive" | "negative"; object: string }[] = [];
  for (let index = 0; index < mix.handguns; index += 1) rows.push({ role: "positive", object: "handgun" });
  for (const [count, object] of [
    [mix.phones, "phone"],
    [mix.flashlights, "flashlight"],
    [mix.umbrellas, "closed umbrella"],
    [mix.drills, "power drill"],
    [mix.bottles, "bottle"],
  ] as const) {
    for (let index = 0; index < count; index += 1) rows.push({ role: "negative", object });
  }
  return rows.map((row, index) => {
    const axes = sceneAxes(index);
    const blocked = (row.role === "negative" ? index % 2 === 1 : index % 5 === 4) ? " The object is partly blocked." : "";
    const action = row.role === "positive"
      ? "A handgun is visible."
      : `The person is holding a ${row.object}. No firearm.`;
    const prompt = `Fixed ${axes.lighting} CCTV camera, ${axes.cameraAngle} angle, ${axes.distance} distance, in a ${axes.place}. A synthetic person wearing a ${axes.clothing} is ${axes.posture}. ${action}${blocked} Scene ${index + 1} of ${size}. ${SYNTHETIC_PERSON}`;
    return sizedScene(batchId, index, row.role, prompt);
  });
}

export function expandCategoryScenes(category: string, size: BatchSize): BatchScene[] {
  if (category === "firearm_like") return firearmScenes(size);
  const subject = CATEGORY_SUBJECT[category];
  if (!subject) return [];
  const batchId = sizedBatchId(category, size);
  const positiveCount = size / 2;
  return Array.from({ length: size }, (_, index) => {
    const axes = sceneAxes(index);
    const role = index < positiveCount ? "positive" : "negative";
    const blocked = (role === "negative" ? index % 2 === 1 : index % 5 === 4) ? " The subject is partly blocked." : "";
    const prompt = `Fixed ${axes.lighting} CCTV camera, ${axes.cameraAngle} angle, ${axes.distance} distance, in a ${axes.place}. A synthetic person wearing a ${axes.clothing} is ${axes.posture}. ${role === "positive" ? subject.positive : subject.negative}${blocked} Scene ${index + 1} of ${size}. ${SYNTHETIC_PERSON}`;
    return sizedScene(batchId, index, role, prompt);
  });
}

export type StillBatchPlan =
  | {
      ok: false;
      reason: string;
      estimatedUsd: number;
      generated: false;
      requiresConfirmation?: boolean;
      batchId?: string;
      positive?: number;
      negative?: number;
      challenging?: number;
    }
  | {
      ok: true;
      batchId: string;
      scenes: BatchScene[];
      estimatedUsd: number;
      positive: number;
      negative: number;
      challenging: number;
      requested: number;
      generated: false;
      requiresConfirmation?: boolean;
    };

function finishPlan(input: {
  choiceName: string;
  batchId: string;
  requested: number;
  scenes: BatchScene[];
  spentUsd: number;
  capUsd: number;
  confirmed: boolean;
}): StillBatchPlan {
  const estimatedUsd = batchEstimateUsd(input.scenes.length);
  if (input.spentUsd + estimatedUsd > input.capUsd) {
    return { ok: false, estimatedUsd, generated: false, reason: "This batch would pass the studio spend cap. No image was requested." };
  }
  const positive = input.scenes.filter((scene) => scene.role === "positive" && scene.difficulty === "standard").length;
  const negative = input.scenes.filter((scene) => scene.role === "negative" && scene.difficulty === "standard").length;
  const challenging = input.scenes.filter((scene) => scene.difficulty === "challenging").length;
  if (!input.confirmed) {
    return {
      ok: false,
      batchId: input.batchId,
      estimatedUsd,
      positive,
      negative,
      challenging,
      generated: false,
      requiresConfirmation: true,
      reason: `Confirm $${estimatedUsd.toFixed(2)} for ${input.scenes.length} ${input.choiceName.toLowerCase()} images before any image is requested.`,
    };
  }
  return {
    ok: true,
    batchId: input.batchId,
    scenes: input.scenes,
    estimatedUsd,
    positive,
    negative,
    challenging,
    requested: input.requested,
    generated: false,
  };
}

export function planStillBatch(input: {
  category: string;
  existingIds: readonly string[];
  spentUsd: number;
  capUsd: number;
  confirmed: boolean;
  batchSize?: number;
}): StillBatchPlan {
  const choice = BATCH_CATEGORY_CHOICES.find((item) => item.id === input.category);
  if (!choice) {
    return { ok: false, estimatedUsd: 0, generated: false, reason: "That category is not a studio class. No image was requested." };
  }
  if (input.batchSize !== undefined && !isBatchSize(input.batchSize)) {
    return { ok: false, estimatedUsd: 0, generated: false, reason: "Choose a batch of 100, 250, 500, or 1,000 images. No image was requested." };
  }
  const taken = new Set(input.existingIds);
  if (input.batchSize === undefined) {
    const next = (PREPARED_BATCHES[choice.id] ?? []).find((set) => set.scenes.some((scene) => !taken.has(scene.id)));
    if (next) {
      return finishPlan({
        choiceName: choice.name,
        batchId: next.batchId,
        requested: next.scenes.length,
        scenes: next.scenes.filter((scene) => !taken.has(scene.id)),
        spentUsd: input.spentUsd,
        capUsd: input.capUsd,
        confirmed: input.confirmed,
      });
    }
  }
  const size = input.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!isBatchSize(size)) {
    return { ok: false, estimatedUsd: 0, generated: false, reason: "Choose a batch of 100, 250, 500, or 1,000 images. No image was requested." };
  }
  const all = expandCategoryScenes(choice.id, size);
  const scenes = all.filter((scene) => !taken.has(scene.id));
  if (scenes.length === 0) {
    return {
      ok: false,
      estimatedUsd: batchEstimateUsd(size),
      generated: false,
      reason: `Every prepared ${choice.name.toLowerCase()} scene is already stored. No image was requested.`,
    };
  }
  return finishPlan({
    choiceName: choice.name,
    batchId: sizedBatchId(choice.id, size),
    requested: all.length,
    scenes,
    spentUsd: input.spentUsd,
    capUsd: input.capUsd,
    confirmed: input.confirmed,
  });
}

export function studioSpendUsd(syntheticCount: number): number {
  return Math.round(syntheticCount * (STILL_BATCH_USD / STILL_BATCH_SIZE) * 100) / 100;
}
