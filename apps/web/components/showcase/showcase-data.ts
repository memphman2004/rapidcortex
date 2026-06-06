export type ScenarioKey = "cardiac" | "fire" | "domestic";

export type ShowcaseTranscriptLine = {
  speaker: "caller" | "dispatcher";
  text: string;
  delay: number;
};

export type ShowcaseAnalysis = {
  category: string;
  urgency: string;
  confidence: number;
  nextQuestion: string;
  recommendedAction: string;
  summary: string;
  rationale: string;
  escalation: boolean;
};

export type ShowcaseScenario = {
  name: string;
  category: string;
  urgency: string;
  transcript: ShowcaseTranscriptLine[];
  analysis: ShowcaseAnalysis;
};

export const SHOWCASE_SCENARIOS: Record<ScenarioKey, ShowcaseScenario> = {
  cardiac: {
    name: "Possible Cardiac Arrest",
    category: "medical",
    urgency: "critical",
    transcript: [
      { speaker: "caller", text: "Please help, my husband just collapsed.", delay: 800 },
      {
        speaker: "dispatcher",
        text: "I’m here with you. Tell me if he is awake or breathing.",
        delay: 1400,
      },
      {
        speaker: "caller",
        text: "He is not breathing and he grabbed his chest.",
        delay: 1800,
      },
      {
        speaker: "dispatcher",
        text: "Okay. Stay on the line. Is there an AED nearby?",
        delay: 2200,
      },
      {
        speaker: "caller",
        text: "Yes, there is one in the lobby downstairs.",
        delay: 2600,
      },
    ],
    analysis: {
      category: "Medical",
      urgency: "Critical",
      confidence: 96,
      nextQuestion:
        "Is anyone there who can start CPR while someone retrieves the AED?",
      recommendedAction:
        "Escalate as critical medical. Begin CPR/AED protocol guidance immediately.",
      summary: "Possible cardiac arrest with collapse, chest pain, and absent breathing.",
      rationale: "Transcript includes collapse, chest pain, and no breathing.",
      escalation: true,
    },
  },
  fire: {
    name: "Structure Fire",
    category: "fire",
    urgency: "high",
    transcript: [
      { speaker: "caller", text: "There is smoke coming from my kitchen ceiling.", delay: 800 },
      { speaker: "dispatcher", text: "Can you safely leave the house right now?", delay: 1300 },
      { speaker: "caller", text: "Yes, but my daughter is upstairs.", delay: 1800 },
      {
        speaker: "dispatcher",
        text: "Get everyone out immediately if you can do so safely.",
        delay: 2300,
      },
      { speaker: "caller", text: "We’re outside now and flames are visible.", delay: 2800 },
    ],
    analysis: {
      category: "Fire",
      urgency: "High",
      confidence: 93,
      nextQuestion: "Is everyone safely out of the structure?",
      recommendedAction: "Escalate fire response and continue evacuation-focused guidance.",
      summary: "Active structure fire with visible smoke and flames.",
      rationale: "Smoke upgraded to visible fire with occupants evacuating.",
      escalation: true,
    },
  },
  domestic: {
    name: "Domestic Disturbance",
    category: "police",
    urgency: "high",
    transcript: [
      { speaker: "caller", text: "My boyfriend is breaking things and yelling.", delay: 900 },
      { speaker: "dispatcher", text: "Are you in a safe place right now?", delay: 1500 },
      { speaker: "caller", text: "I’m in the bathroom with my child.", delay: 1900 },
      {
        speaker: "dispatcher",
        text: "Stay where you are if it is safe. Is he trying to get in?",
        delay: 2400,
      },
      { speaker: "caller", text: "Yes, he’s hitting the door.", delay: 2900 },
    ],
    analysis: {
      category: "Police",
      urgency: "High",
      confidence: 91,
      nextQuestion: "Is there a weapon involved or has he threatened either of you?",
      recommendedAction: "Escalate law enforcement response and maintain caller safety guidance.",
      summary: "Escalating domestic disturbance with child present and forced entry risk.",
      rationale: "Active threat, caller hiding, child present.",
      escalation: true,
    },
  },
};

export type StarterIncident = {
  id: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  opened: string;
  preview: string;
  source: string;
};

export const STARTER_INCIDENTS: StarterIncident[] = [
  {
    id: "RC-10017",
    title: "Possible Cardiac Arrest",
    category: "Medical",
    urgency: "Critical",
    status: "Active",
    opened: "00:42",
    preview: "Caller reports collapse and no breathing.",
    source: "Live Demo",
  },
  {
    id: "RC-10018",
    title: "Structure Fire",
    category: "Fire",
    urgency: "High",
    status: "Queued",
    opened: "01:13",
    preview: "Smoke reported in kitchen area.",
    source: "Demo Queue",
  },
  {
    id: "RC-10019",
    title: "Domestic Disturbance",
    category: "Police",
    urgency: "High",
    status: "Queued",
    opened: "02:01",
    preview: "Caller sheltering with child.",
    source: "Demo Queue",
  },
];
