import type { GuestAssistChatBody, GuestAssistVertical } from "rapid-cortex-shared";

const EMERGENCY_RE =
  /\b(911|stab|stabb|shot|shoot|gun|knife|weapon|unconscious|not breathing|overdose|heart attack|stroke|seizure|fire|bleed|assault|attack|chok|dying|ambulance)\b/i;

function lastUserText(body: GuestAssistChatBody): string {
  return [...body.messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
}

function site(body: GuestAssistChatBody): { name: string; loc: string; vertical: GuestAssistVertical } {
  return {
    name: body.name?.trim() || "this site",
    loc: body.location?.trim() || "your current location",
    vertical: body.vertical,
  };
}

function isStaff(body: GuestAssistChatBody): boolean {
  return /sign messages as|staff member|campus safety officer|transit control/i.test(body.system);
}

function emergencyReply(name: string, loc: string): string {
  return [
    `If anyone is in immediate danger, call 911 now. Stay on the line with the dispatcher.`,
    `Tell them you are at ${name}, ${loc}. Give the nearest gate, section, or landmark if you know it.`,
    `Move to a safe, well-lit area if you can. Do not approach a person with a weapon.`,
    `On-site security can also be alerted from the Emergency button on this page. 911 is still the first call for a life-threatening event.`,
  ].join("\n\n");
}

function restroomReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "campus") {
    return [
      `Closest restrooms to ${loc} at ${name} are usually in the nearest occupied building lobby or student-union level.`,
      `From where you are: follow hallway or quad signs for Restroom / WC. Family and accessible restrooms are typically next to the main restrooms on the same floor.`,
      `If you do not see a sign within a minute, ask the nearest building desk or campus staff — they can walk you there.`,
    ].join("\n\n");
  }
  if (vertical === "transit") {
    return [
      `Station restrooms at ${name} (${loc}) are usually past fare control, on the mezzanine, or next to the customer-service booth.`,
      `Follow “Restroom” signs toward the agent booth. If this stop has no public restroom, the next major station or transit hub will — ask an agent before you re-enter unpaid area.`,
      `Accessible restrooms, when available, are marked ADA next to the main restroom.`,
    ].join("\n\n");
  }
  return [
    `Restrooms at ${name} are on this concourse level, typically every 40–60 yards along the main walkway.`,
    `From ${loc}: face the seating bowl, then walk the concourse toward the nearest Restroom / Family / ADA sign. Family and accessible restrooms sit beside the main restrooms.`,
    `If you do not see a sign within about a minute, ask an usher or guest-services staff in a venue shirt — they can walk you there.`,
  ].join("\n\n");
}

function parkingReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "transit") {
    return [
      `Park-and-ride and station parking for ${name} is signed on the approach roads to ${loc}. Overnight rules vary by lot.`,
      `Use the official ${name} app or posted lot signs for rates and last-exit time. If you already parked, note the lot letter/number on the nearest light pole before you go to the platform.`,
    ].join("\n\n");
  }
  if (vertical === "campus") {
    return [
      `Visitor and permit lots at ${name} are marked on campus maps. From ${loc}, follow Parking / P signs to the nearest garage or lot.`,
      `Pay-by-plate or permit rules are on the lot kiosk. Accessible parking is closest to building entrances. Campus parking enforcement can help if you cannot find a space.`,
    ].join("\n\n");
  }
  return [
    `Parking for ${name} is in the official lots and decks around the venue. From ${loc} you are already inside — you do not need to go back through parking to use restrooms or guest services.`,
    `After the event, follow “Parking / Lots / Rideshare” signs on your concourse toward your lot letter or deck color. Screenshot your lot row if you have not already.`,
    `Rideshare pickup is usually a dedicated curb outside a numbered gate, not the main taxi lane. Ask guest services if you are not sure which gate matches your lot.`,
  ].join("\n\n");
}

function firstAidReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "campus") {
    return [
      `For a medical emergency at ${name}, call 911. Campus police and EMS will respond to ${loc}.`,
      `Non-emergency first aid: go to the nearest staffed building desk or the campus health center and say you need first aid. An AED is usually in the lobby of large buildings.`,
    ].join("\n\n");
  }
  if (vertical === "transit") {
    return [
      `If someone is badly hurt at ${loc}, call 911 and tell them you are on ${name}.`,
      `For minor first aid, go to the agent booth or platform staff. Many stations have an AED marked on the mezzanine.`,
    ].join("\n\n");
  }
  return [
    `First aid at ${name} is at guest-services / first-aid posts on the main concourse — look for a red cross or “First Aid” sign.`,
    `From ${loc}, walk the concourse toward Guest Services. Tell them the section or landmark you came from so they can send a medic if needed.`,
    `If someone is unresponsive, not breathing, or bleeding heavily, call 911 first, then flag the nearest usher.`,
  ].join("\n\n");
}

function exitReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "transit") {
    return [
      `Follow “Exit / Street” signs from ${loc}. Paid-area exits go through fare gates to the mezzanine, then to the street.`,
      `Accessible exits are marked with the ADA symbol. If a gate is closed, use the next signed exit — do not go onto the track.`,
    ].join("\n\n");
  }
  if (vertical === "campus") {
    return [
      `From ${loc}, follow Exit / Stair signs to the nearest building exit, then campus paths toward the main quad or your parking lot.`,
      `Accessible routes are the ramped or elevator path, not the stairwell. In an alarm, use stairs unless you need elevator assistance from staff.`,
    ].join("\n\n");
  }
  return [
    `Exits at ${name} are numbered gates around the bowl. From ${loc}, follow “Exit / Gates” signs along the concourse — they lead to the nearest numbered gate, then to the plaza.`,
    `Your ticket gate is usually the fastest way back to parking or rideshare. Accessible exits are elevator/ramp routes signed ADA; do not use field-level tunnels unless staff directs you.`,
    `If an alarm sounds, walk to the nearest lit exit. Do not go against crowd flow unless staff reroutes you.`,
  ].join("\n\n");
}

function seatReply(name: string, loc: string): string {
  return [
    `To find your seat at ${name} from ${loc}, match the section number on your ticket to overhead concourse signs, then use the vomitory (tunnel) for that section.`,
    `Row letters/numbers increase as you go down toward the field. Ushers at the section opening can walk you to the exact row.`,
    `If your ticket is a club or suite, look for Club / Suite elevators rather than general seating tunnels.`,
  ].join("\n\n");
}

function bagPolicyReply(name: string): string {
  return [
    `${name} follows a clear-bag policy at most events: small clutches (about 4.5" × 6.5") or clear bags up to 12" × 6" × 12". Backpacks and large totes are usually not allowed.`,
    `Medical and parenting bags are typically allowed after screening. If a bag is refused, bag check is at guest services near the main gates — ask the nearest screener.`,
    `Policies can vary by event promoter. The posted sign at your gate is the rule for today.`,
  ].join("\n\n");
}

function foodReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "campus") {
    return [
      `Dining near ${loc} at ${name}: follow signs to the student union, food court, or the nearest open café in this building.`,
      `Hours vary by academic calendar. The union information desk can tell you what is open now.`,
    ].join("\n\n");
  }
  if (vertical === "transit") {
    return [
      `Food at ${loc} is usually limited to mezzanine kiosks or street-level shops outside fare control.`,
      `If you leave paid area to eat, you may need a new fare to re-enter. Ask the agent before you exit.`,
    ].join("\n\n");
  }
  return [
    `Concessions at ${name} line the concourse near ${loc} — look for stand numbers on the fascia above the walkway.`,
    `Water bottle fillers and standard stands are on this level; clubs and restaurants are on suite/club levels via the nearest elevator.`,
    `Card and tap-to-pay are standard. Guest services can point you to allergen or alcohol-free options.`,
  ].join("\n\n");
}

function lostReply(name: string, loc: string, vertical: GuestAssistVertical): string {
  if (vertical === "campus") {
    return [
      `Lost & found at ${name} is usually with campus police or the student-union information desk. Describe the item, where you last had it (near ${loc}), and a callback number.`,
      `Lost ID / OneCard: go to the ID office or campus police immediately. For a lost child or missing person, call campus police or 911 now.`,
    ].join("\n\n");
  }
  if (vertical === "transit") {
    return [
      `Lost items on ${name} go to the system lost-and-found (often the main hub, not this stop). Give route/car number if you have it, plus ${loc} and time.`,
      `A lost child or at-risk person is an emergency: tell an agent and call 911.`,
    ].join("\n\n");
  }
  return [
    `Lost & found at ${name} is at Guest Services. From ${loc}, follow Guest Services signs on the concourse.`,
    `Give a description, the section/row if you know it, and a phone number. For a lost child, tell the nearest usher and venue security immediately — do not wait in the lost-and-found line.`,
  ].join("\n\n");
}

function defaultReply(name: string, loc: string, vertical: GuestAssistVertical, question: string): string {
  const ask = question ? ` You asked: “${question.slice(0, 160)}”.` : "";
  if (vertical === "campus") {
    return [
      `I can help at ${name} near ${loc}.${ask}`,
      `I can give directions to buildings, parking, restrooms, student services, and how to reach campus safety. Tell me the building, office, or service you need and I will walk you through it step by step.`,
      `If this is an emergency or someone is in danger, call 911.`,
    ].join("\n\n");
  }
  if (vertical === "transit") {
    return [
      `I can help on ${name} at ${loc}.${ask}`,
      `I can cover next-train style questions, fares, elevators, exits, and how to report a station issue. Tell me your destination or the problem and I will give complete steps.`,
      `If this is an emergency or a suspicious item, call 911 and move away from the edge of the platform.`,
    ].join("\n\n");
  }
  return [
    `I can help at ${name} near ${loc}.${ask}`,
    `I can give complete directions for restrooms, seats, first aid, exits, parking/rideshare, bag policy, concessions, and lost & found. Tell me where you need to go (or tap a suggestion chip) and I will give turn-by-turn steps from ${loc}.`,
    `If someone is in danger, call 911 — this assistant is not a 911 dispatch center.`,
  ].join("\n\n");
}

/**
 * On-device / no-Claude answers. Must be complete (steps + landmarks), not a one-line brush-off.
 * 911 only when the guest describes danger.
 */
export function guestAssistLocalReply(body: GuestAssistChatBody): string {
  const { name, loc, vertical } = site(body);
  const q = lastUserText(body);
  if (!q) {
    return defaultReply(name, loc, vertical, "");
  }
  if (EMERGENCY_RE.test(q)) {
    return emergencyReply(name, loc);
  }
  if (isStaff(body) && EMERGENCY_RE.test(q)) {
    return emergencyReply(name, loc);
  }

  const t = q.toLowerCase();
  if (/\b(restroom|bathroom|toilet|wc|latrine)\b/.test(t)) return restroomReply(name, loc, vertical);
  if (/\b(park|parking|garage|deck|lot)\b/.test(t)) return parkingReply(name, loc, vertical);
  if (/\b(first aid|first-aid|medic|nurse|aed|emt)\b/.test(t)) return firstAidReply(name, loc, vertical);
  if (/\b(exit|way out|leave|gate out)\b/.test(t)) return exitReply(name, loc, vertical);
  if (/\b(seat|section|row|suite|club level)\b/.test(t)) return seatReply(name, loc);
  if (/\b(bag|clear bag|backpack|purse|clutch)\b/.test(t)) return bagPolicyReply(name);
  if (/\b(food|drink|concession|hungry|eat|beer|water)\b/.test(t)) return foodReply(name, loc, vertical);
  if (/\b(lost|found|missing)\b/.test(t)) return lostReply(name, loc, vertical);

  if (isStaff(body)) {
    return [
      `This is ${vertical === "campus" ? "Campus Safety" : vertical === "transit" ? "Transit Control" : "Venue Security"} at ${name}. We have you at ${loc}.`,
      q ? `We noted: “${q.slice(0, 180)}”.` : "",
      `Stay where you are if it is safe. A teammate can meet you at ${loc}. If anyone is in immediate danger, call 911 now.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return defaultReply(name, loc, vertical, q);
}
