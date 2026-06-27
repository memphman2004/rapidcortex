import type { BlogPost } from "./types";

export const launchPosts: BlogPost[] = [
  {
    slug: "why-rapid-cortex-is-needed",
    title: "Why Rapid Cortex Is Needed: The Future of Real-Time Incident Intelligence",
    description:
      "911 centers, campuses, and venues all face the same problem: information about a critical incident arrives too slowly. Here's why that's changing.",
    category: "Industry Perspective",
    tags: [
      "emergency communication software",
      "public safety technology",
      "incident intelligence platform",
      "ng911",
    ],
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: "2026-04-02",
    readingTimeMinutes: 7,
    content: [
      {
        type: "paragraph",
        text:
          "A fire alarm in a stadium concourse. A student who notices someone in distress outside a dorm. A caller dialing 911 from a wreck on a dark stretch of highway. Each of these moments unfolds in real time. The information about what's happening, where, and how serious — too often does not.",
      },
      {
        type: "heading",
        level: 2,
        id: "where-information-gets-stuck",
        text: "Where information gets stuck",
      },
      {
        type: "paragraph",
        text:
          "911 centers depend on voice calls and CAD entry. Campuses depend on a mix of phone calls, emails, and word of mouth. Venues depend on radios and line-of-sight from security staff walking a floor. Each channel works fine on a normal day. The gap shows up the moment volume rises, or the person who needs to report something doesn't have an easy way to do it.",
      },
      {
        type: "list",
        items: [
          "A caller's exact location takes precious time to confirm because there's no structured way to share it.",
          "A student notices something concerning but has no fast, low-friction way to tell anyone.",
          "A venue guest sees an issue mid-event but has no idea which staff member to flag, or how.",
        ],
      },
      {
        type: "heading",
        level: 2,
        id: "cost-of-delay",
        text: "The cost of delay during a critical incident",
      },
      {
        type: "paragraph",
        text:
          "Every minute spent re-establishing basic facts — where, what, who's involved — is a minute responders aren't moving toward the problem. In life-safety environments, that gap affects outcomes directly. Not because the people involved aren't capable, but because the tools available to them weren't built to close it.",
      },
      {
        type: "heading",
        level: 2,
        id: "legacy-systems",
        text: "Why legacy systems aren't built for this",
      },
      {
        type: "paragraph",
        text:
          "CAD and telephony systems were built for one channel at a time: a phone call comes in, a dispatcher enters structured fields, a unit gets dispatched. That model holds up well for voice calls. It holds up far less well once incidents involve text messages, photos, video, multilingual callers, or reports that originate somewhere other than a phone call entirely — a stadium concourse, a dorm hallway, a building most 911 systems have no visibility into at all.",
      },
      {
        type: "heading",
        level: 3,
        id: "what-ng911-changes",
        text: "What NG911 changes",
      },
      {
        type: "paragraph",
        text:
          "Next Generation 911 (NG911) is the industry's response to exactly this gap — a shift in the underlying 911 network from voice-only, circuit-switched calls to an IP-based system that can carry text, photos, video, and data alongside a call. NG911 changes what a 911 center is capable of receiving. It doesn't, on its own, change what a dispatcher's screen looks like or how that information gets organized once it arrives. That's a software problem, not a network problem — and it's the same software problem campuses and venues face even where NG911 isn't directly involved.",
      },
      {
        type: "heading",
        level: 2,
        id: "where-intelligence-platforms-fit",
        text: "Where real-time intelligence platforms fit",
      },
      {
        type: "paragraph",
        text:
          "An incident intelligence platform sits alongside the existing systems of record — CAD, telephony, emergency notification systems — and does the work of capturing information the moment it's available, structuring it, and putting it in front of a human who can act on it. It isn't a replacement for any of those systems. It's the layer that was missing between \"something happened\" and \"the right person has the context to respond.\"",
      },
      {
        type: "heading",
        level: 2,
        id: "how-rapid-cortex-bridges-the-gap",
        text: "How Rapid Cortex bridges the gap",
      },
      {
        type: "paragraph",
        text:
          "This is the problem Rapid Cortex was built to solve, in three environments at once: [Rapid Cortex Core](/product/core) inside 911 centers and PSAPs, [Rapid Cortex Venue](/venue) inside stadiums, arenas, and large gatherings, and [Rapid Cortex Campus](/product/campus) on university and school campuses. The environments differ. The underlying problem doesn't — get accurate, structured incident information in front of a trained human fast enough for it to matter, without asking anyone to adopt a new app or change how they already report something. We cover how those three pieces fit together as one platform in [Rapid Cortex Offerings: One Platform, Three Powerful Solutions](/blog/rapid-cortex-offerings).",
      },
      {
        type: "paragraph",
        text:
          "Information delay isn't usually a training problem or a staffing problem. It's an infrastructure gap — and it's one that's closing.",
      },
    ],
    cta: {
      eyebrow: "See the platform in action",
      text:
        "Rapid Cortex brings real-time incident intelligence to 911 centers, campuses, and venues without replacing the systems you already rely on.",
      buttonLabel: "Schedule a Demo",
      href: "/demo",
    },
  },
  {
    slug: "rapid-cortex-offerings",
    title: "Rapid Cortex Offerings: One Platform, Three Powerful Solutions",
    description:
      "Rapid Cortex Core, Venue, and Campus share one technology foundation built for three different public safety environments. Here's how they fit together.",
    category: "Product",
    tags: [
      "public safety software",
      "venue safety technology",
      "campus safety platform",
      "incident management software",
    ],
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: "2026-04-09",
    readingTimeMinutes: 7,
    content: [
      {
        type: "paragraph",
        text:
          "Rapid Cortex isn't three separate products that happen to share a name. It's one incident-intelligence platform, configured for three environments that each need it for a different reason: 911 centers, large venues, and campuses. [Why Rapid Cortex Is Needed](/blog/why-rapid-cortex-is-needed) covers the underlying problem; this is how we solve it.",
      },
      {
        type: "heading",
        level: 2,
        id: "shared-foundation",
        text: "A shared technology foundation",
      },
      {
        type: "paragraph",
        text:
          "Every Rapid Cortex deployment, regardless of vertical, is built on the same underlying layer: role-based access control so each person only sees what their role requires, append-only audit logging for sensitive actions, encrypted intake and storage for photos, video, and messages, and a QR code, NFC tag, and SMS-based reporting infrastructure that lets anyone report something without downloading an app. Security posture is consistent across every deployment, built around CJIS-aware design principles rather than bolted on per vertical.",
      },
      {
        type: "heading",
        level: 3,
        id: "shared-infrastructure-independent-deployments",
        text: "Shared infrastructure, independent deployments",
      },
      {
        type: "paragraph",
        text:
          "A shared foundation doesn't mean every agency sees the same thing. A 911 center's dispatcher console, a stadium's security console, and a campus safety console are each built around the workflow of the people using them — with their own color-coded role bands, escalation paths, and reporting categories. The infrastructure underneath is shared so that improvements in one area, like faster media intake or stronger audit trails, benefit every deployment, not just one.",
      },
      {
        type: "heading",
        level: 2,
        id: "rapid-cortex-core-overview",
        text: "Rapid Cortex Core — built for 911 centers and PSAPs",
      },
      {
        type: "paragraph",
        text:
          "[Rapid Cortex Core](/product/core) brings real-time transcription, multi-language translation, and structured incident intelligence directly into the call-taking and dispatch workflow, alongside the CAD and telephony systems a center already runs. We go deeper on Core in [Rapid Cortex Core: Modernizing Emergency Communications Without Replacing Existing Systems](/blog/rapid-cortex-core).",
      },
      {
        type: "heading",
        level: 2,
        id: "rapid-cortex-venue-overview",
        text: "Rapid Cortex Venue — built for stadiums, arenas, and large gatherings",
      },
      {
        type: "paragraph",
        text:
          "[Rapid Cortex Venue](/venue) gives guests, fans, and staff a way to report a safety concern from anywhere in a facility — scanning a code, tapping an NFC sign, or sending a text — and gives venue security a zone-based view of what's being reported and where. More in [Rapid Cortex Venue: Enhancing Safety Inside Stadiums, Arenas, Airports, and Large Gatherings](/blog/rapid-cortex-venue).",
      },
      {
        type: "heading",
        level: 2,
        id: "rapid-cortex-campus-overview",
        text: "Rapid Cortex Campus — built for universities and schools",
      },
      {
        type: "paragraph",
        text:
          "[Rapid Cortex Campus](/product/campus) applies the same low-friction reporting model to campuses, with routing built for the realities of student life: anonymous options, location-aware reports, and a dedicated path for welfare and mental-health concerns that don't belong in a security queue. Full detail in [Rapid Cortex Campus: Empowering Students to Report Safety Concerns Instantly](/blog/rapid-cortex-campus).",
      },
      {
        type: "heading",
        level: 2,
        id: "scale-and-integrate",
        text: "Built to scale and integrate",
      },
      {
        type: "paragraph",
        text:
          "A single PSAP and a 70,000-seat stadium have almost nothing in common operationally, except this: both need information to move fast, and both already have systems they're not going to rip out to get it. Every Rapid Cortex deployment is scoped to the agency it serves and built to sit alongside CAD, telephony, and existing emergency notification systems rather than replace them. Deployment scope is quoted per agency on our [pricing page](/pricing).",
      },
    ],
    cta: {
      eyebrow: "One platform, scoped to you",
      text:
        "See which Rapid Cortex solution fits your environment, and how the underlying platform adapts to it.",
      buttonLabel: "Schedule a Demo",
      href: "/demo",
    },
  },
  {
    slug: "rapid-cortex-core",
    title: "Rapid Cortex Core: Modernizing Emergency Communications Without Replacing Existing Systems",
    description:
      "Real-time transcription, multi-language translation, and structured incident intelligence for 911 centers and PSAPs — built to work alongside CAD, not instead of it.",
    category: "Rapid Cortex Core",
    tags: ["911 software", "psap technology", "dispatch intelligence", "cad integration"],
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: "2026-04-16",
    readingTimeMinutes: 9,
    content: [
      {
        type: "paragraph",
        text:
          "A Public Safety Answering Point, or PSAP, runs on two systems above all others: telephony, to take the call, and CAD, to dispatch the right resources. [Rapid Cortex Core](/product/core) doesn't replace either one. It sits alongside them, doing the work neither was originally designed to do — turning a live call into structured, searchable, multilingual incident intelligence in real time.",
      },
      {
        type: "heading",
        level: 2,
        id: "real-time-transcription",
        text: "Real-time transcription, without replacing the call-taker",
      },
      {
        type: "paragraph",
        text:
          "Every call is transcribed as it happens, with speaker separation between caller and call-taker so the transcript reads like a conversation, not a wall of text. Dispatchers and supervisors can correct or annotate a transcript directly, and every call becomes part of a searchable archive — useful for quality assurance, training, and answering exactly what a caller said long after the call ends. The call-taker is still running the call. The transcript is just no longer something someone has to reconstruct from memory afterward.",
      },
      {
        type: "heading",
        level: 2,
        id: "multi-language-translation",
        text: "Multi-language translation for callers who don't speak English",
      },
      {
        type: "paragraph",
        text:
          "Core supports real-time translation across 40-plus languages, with original and translated text shown side by side so the call-taker sees exactly what was said, not a paraphrase. When a translation looks uncertain, the system flags it rather than presenting it with false confidence, and agencies can still escalate to a live interpreter when policy calls for one. The goal isn't to remove the option of a human interpreter — it's to make sure language is never the reason a call-taker can't get to the basic facts of an emergency quickly.",
      },
      {
        type: "heading",
        level: 2,
        id: "secure-multimedia-intake",
        text: "Secure multimedia intake during the call",
      },
      {
        type: "paragraph",
        text:
          "When a caller can safely send a photo or short video, that context changes how a call gets handled — a structure fire isn't the same dispatch as smoke from a chimney, and a single photo settles the question faster than a description can. Core sends a secure, time-limited link by SMS for the caller to upload media. Nothing is collected without that explicit step, and everything collected is encrypted and logged the way any sensitive evidence should be.",
      },
      {
        type: "heading",
        level: 2,
        id: "supervisor-visibility",
        text: "Supervisor visibility without micromanagement",
      },
      {
        type: "paragraph",
        text:
          "Supervisors get a live view of queue depth, active calls, and individual call status, with the ability to silently monitor a live call where agency policy allows it. The same tools double as training infrastructure: call review with synchronized transcript playback, structured QA scoring, and performance trends over time — built around coaching, not just oversight.",
      },
      {
        type: "heading",
        level: 2,
        id: "ng911-readiness",
        text: "NG911 readiness",
      },
      {
        type: "paragraph",
        text:
          "Next Generation 911 networks are built to carry far more than voice — text, photos, video, and structured data alongside a call. Core is built around that same assumption from the start, so a PSAP doesn't need a second platform to make sense of the multimedia and multilingual call types an NG911 network is designed to deliver. As more PSAPs complete their NG911 transition, the bottleneck shifts from \"can we receive this\" to \"can we do anything useful with it\" — and that's the layer Core fills.",
      },
      {
        type: "heading",
        level: 2,
        id: "works-alongside-cad",
        text: "Works alongside your CAD and telephony — not instead of them",
      },
      {
        type: "paragraph",
        text:
          "Core is explicitly designed not to replace a center's CAD, telephony, dispatchers, or call-takers. It enhances what's already there.",
      },
      {
        type: "heading",
        level: 3,
        id: "phased-path-to-integration",
        text: "A phased path to integration",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Standalone first: Core runs independently while a center evaluates it, with no custom integration work and no changes to existing CAD workflows.",
          "Assisted next: extracted call data one-click transfers into CAD fields, with the call-taker reviewing and confirming before anything is finalized.",
          "Bidirectional later: for agencies that want it, status and disposition updates flow back from CAD into Core in real time, once the CAD vendor's integration capabilities support it.",
        ],
      },
      {
        type: "paragraph",
        text:
          "Most agencies start at the first step and move forward on their own timeline. None of the steps require giving anything up that already works.",
      },
      {
        type: "callout",
        tone: "note",
        label: "A note on compliance",
        text:
          "Core is built around CJIS-aware security principles — role-based access, audit logging, encryption in transit and at rest, and support for advanced authentication. We don't describe that as CJIS certified, because that isn't a status any vendor can hold. We work directly with your agency to align our controls to your CJIS Systems Agency's requirements.",
      },
      {
        type: "paragraph",
        text:
          "The systems a 911 center already trusts stay exactly where they are. What changes is how much a call-taker can see, understand, and act on while the call is still live — and [Rapid Cortex Venue](/venue) and [Rapid Cortex Campus](/product/campus) extend that same real-time visibility to the environments that so often report into 911 in the first place.",
      },
    ],
    cta: {
      eyebrow: "See Core on a live call flow",
      text:
        "Walk through real-time transcription, translation, and multimedia intake the way your call-takers would actually use them.",
      buttonLabel: "Request a Pilot",
      href: "/demo",
    },
  },
  {
    slug: "rapid-cortex-venue",
    title: "Rapid Cortex Venue: Enhancing Safety Inside Stadiums, Arenas, Airports, and Large Gatherings",
    description:
      "QR code and text-based safety reporting, real-time photos and video, and zone-based security coordination for stadiums, arenas, and other large venues.",
    category: "Rapid Cortex Venue",
    tags: [
      "venue safety platform",
      "stadium security software",
      "airport incident reporting",
      "fan safety technology",
    ],
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: "2026-04-23",
    readingTimeMinutes: 8,
    content: [
      {
        type: "paragraph",
        text:
          "A stadium holds tens of thousands of people and a security team that, no matter how well trained, cannot be everywhere at once. The gap isn't awareness — it's that most guests who notice something have no fast way to tell anyone who could act on it. [Rapid Cortex Venue](/venue) closes that gap without asking a single guest to download anything.",
      },
      {
        type: "heading",
        level: 2,
        id: "reporting-without-an-app",
        text: "Reporting without downloading an app",
      },
      {
        type: "paragraph",
        text:
          "Every reporting point in a venue — a concourse sign, a seatback sticker, a restroom corridor placard — offers three ways in: scan a QR code, tap an NFC-enabled sign, or send a text to a dedicated number. All three open the same simple reporting form. No app, no account, no login. Venues can offer an anonymous option alongside an identified one, and most choose to offer both so a guest's comfort level doesn't determine whether they report something at all.",
      },
      {
        type: "heading",
        level: 2,
        id: "photos-and-video",
        text: "Photos and video, not just a description",
      },
      {
        type: "paragraph",
        text:
          "A guest describing a disturbance near a section gives security a starting point. A guest attaching a photo from that exact spot gives them a starting point and a real picture of what they're walking into. Venue lets guests attach real-time photos and video directly to a report, so the responding security team has visual context before they arrive, not just after.",
      },
      {
        type: "heading",
        level: 2,
        id: "zone-based-awareness",
        text: "Zone-based awareness across a large footprint",
      },
      {
        type: "paragraph",
        text:
          "Every QR code and NFC tag in a venue is tied to a specific zone — a gate, a section, a concourse — so a report carries its exact location automatically. Security doesn't spend the first minute of a response asking where exactly someone is, because the sign the guest scanned already answered that question.",
      },
      {
        type: "heading",
        level: 2,
        id: "coordinating-security-teams",
        text: "Coordinating security teams in real time",
      },
      {
        type: "paragraph",
        text:
          "Incoming reports land in a shared, zone-based incident view, so the right team gets the right report instead of every report broadcasting to every radio channel. Security staff can message a reporting guest directly through two-way chat to ask a clarifying question or confirm they're safe — without exchanging a personal phone number.",
      },
      {
        type: "heading",
        level: 3,
        id: "what-supervisors-see",
        text: "What supervisors see",
      },
      {
        type: "paragraph",
        text:
          "Event supervisors get a live view across every zone at once: open reports, response status, and which staff member is handling what. After the event, that same record supports a debrief — scan counts, report counts, response times — instead of relying on memory and radio logs to reconstruct what happened.",
      },
      {
        type: "heading",
        level: 2,
        id: "escalating-to-911",
        text: "Escalating to 911 when it's more than a venue issue",
      },
      {
        type: "paragraph",
        text:
          "Most reports a venue receives stay within venue security: a spill, a disruptive guest, a medical request for an usher. Some don't. Venue is built to make the handoff to local 911 dispatch fast and clear when an incident crosses that line — because [Rapid Cortex Core](/product/core) runs on the same underlying platform, the context gathered at the venue doesn't have to be re-explained from scratch to the PSAP picking it up. Venue extends visibility into what's happening on the ground. It does not replace law enforcement, EMS, or a venue's existing security staff and protocols.",
      },
      {
        type: "paragraph",
        text:
          "The same low-friction reporting model that works inside a stadium concourse works just as well in a school hallway — which is exactly what [Rapid Cortex Campus](/product/campus) is built for. See [Rapid Cortex Campus: Empowering Students to Report Safety Concerns Instantly](/blog/rapid-cortex-campus).",
      },
    ],
    cta: {
      eyebrow: "See it on your floor plan",
      text:
        "Walk through how QR, NFC, and SMS reporting map onto your venue's actual gates, sections, and concourses.",
      buttonLabel: "Schedule a Demo",
      href: "/demo",
    },
  },
  {
    slug: "rapid-cortex-campus",
    title: "Rapid Cortex Campus: Empowering Students to Report Safety Concerns Instantly",
    description:
      "No-app safety reporting for universities and schools, with location-aware reports, anonymous options, and documentation that supports Clery Act recordkeeping.",
    category: "Rapid Cortex Campus",
    tags: [
      "campus safety software",
      "university safety platform",
      "clery act compliance",
      "student reporting system",
    ],
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: "2026-04-30",
    readingTimeMinutes: 8,
    content: [
      {
        type: "paragraph",
        text:
          "Students already have their phones out. The friction isn't getting their attention — it's everything that happens between noticing something and a trained person actually knowing about it. [Rapid Cortex Campus](/product/campus) is built to close that specific gap: see something, report it in under a minute, and have it land with the right person on campus.",
      },
      {
        type: "heading",
        level: 2,
        id: "no-app-required",
        text: "No app to download, no account to create",
      },
      {
        type: "paragraph",
        text:
          "Every reporting point on a campus — a QR code in a stairwell, an NFC sticker near a building entrance, a dedicated text number — works the same way Venue does: scan, tap, or text, and the report goes straight to campus security. No app, no login, and an anonymous option for students who want to report something without attaching their name to it.",
      },
      {
        type: "heading",
        level: 2,
        id: "location-aware-reporting",
        text: "From a hallway, not from memory",
      },
      {
        type: "paragraph",
        text:
          "A code posted in a specific building or floor carries that location automatically, so a report doesn't start with uncertainty about which building someone even means. For students texting in directly rather than scanning a code, an opt-in location link fills the same gap, turning a vague description into an actual point on a map campus security can act on.",
      },
      {
        type: "heading",
        level: 2,
        id: "more-than-see-something-say-something",
        text: "More than \"see something, say something\" for emergencies",
      },
      {
        type: "paragraph",
        text:
          "Not every report a campus receives is a security matter, and Campus is built around that distinction rather than around it. Suspicious activity and safety hazards route to campus security. Welfare and mental-health concerns route to a separate queue built for campus counseling staff, not a security dispatcher who isn't trained or positioned to be the first response to that kind of report.",
      },
      {
        type: "heading",
        level: 3,
        id: "routing-to-the-right-responder",
        text: "Routing to the right responder",
      },
      {
        type: "paragraph",
        text:
          "Each campus role — security, supervisor, counselor, faculty — sees a console scoped to what they're actually responsible for. A faculty member can submit a report. A counselor sees the welfare-check queue and nothing tied to active security incidents. The separation isn't cosmetic; it determines who actually sees a report, and how fast.",
      },
      {
        type: "heading",
        level: 2,
        id: "clery-act-recordkeeping",
        text: "Documentation that supports Clery Act recordkeeping",
      },
      {
        type: "paragraph",
        text:
          "Every report on Rapid Cortex Campus creates a timestamped, auditable record of what was reported, when, and how it was handled — records of reported incidents, response actions, and disposition history, all in one searchable place instead of scattered across email threads and paper logs. That record supports the documentation a campus needs for its own Clery Act reporting and recordkeeping obligations. Clery Act compliance itself remains the institution's legal responsibility, not something any software vendor can claim to deliver on its own; Campus is built to make that responsibility easier to document, not to replace the judgment of the people who own it.",
      },
      {
        type: "heading",
        level: 2,
        id: "alongside-existing-ens",
        text: "Built alongside your existing emergency notification system",
      },
      {
        type: "paragraph",
        text:
          "Most campuses already run a mass notification system for outbound alerts. Campus isn't a replacement for that system — it's built to work alongside it, filling the inbound side of the equation: getting a report from a student to campus security in the first place, rather than broadcasting an alert outward once an incident is already underway.",
      },
      {
        type: "paragraph",
        text:
          "The reporting model is the same one [Rapid Cortex Venue](/venue) uses inside stadiums and arenas, because the underlying problem — getting a report from the person who noticed something to the person trained to act on it — doesn't change much between a concourse and a quad. See how the pieces fit together in [Rapid Cortex Offerings: One Platform, Three Powerful Solutions](/blog/rapid-cortex-offerings).",
      },
    ],
    cta: {
      eyebrow: "Scope a pilot for your campus",
      text:
        "See how QR, NFC, and text-based reporting would map onto your buildings, and how welfare-check routing works in practice.",
      buttonLabel: "Request a Pilot",
      href: "/demo",
    },
  },
];
