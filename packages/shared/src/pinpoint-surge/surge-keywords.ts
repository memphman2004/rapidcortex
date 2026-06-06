/**
 * Predefined keyword lists for clustering emergency calls.
 * Keywords are lowercase for case-insensitive matching.
 */
export const SURGE_KEYWORDS = {
  traffic: [
    "crash",
    "accident",
    "collision",
    "wreck",
    "vehicle",
    "car",
    "truck",
    "semi",
    "motorcycle",
    "i-75",
    "i-275",
    "northbound",
    "southbound",
    "eastbound",
    "westbound",
    "highway",
    "interstate",
    "exit",
    "traffic",
    "blocked",
    "lanes",
    "overturned",
    "rollover",
    "flipped",
  ],

  fire: [
    "fire",
    "smoke",
    "flames",
    "burning",
    "smell smoke",
    "fire alarm",
    "alarm going off",
    "building",
    "house",
    "apartment",
    "explosion",
    "gas leak",
    "propane",
  ],

  medical: [
    "injured",
    "hurt",
    "bleeding",
    "unconscious",
    "chest pain",
    "heart attack",
    "stroke",
    "breathing",
    "seizure",
    "overdose",
    "fell",
    "fell down",
    "collapsed",
    "not responding",
    "unresponsive",
  ],

  violence: [
    "shooting",
    "shots fired",
    "gunshots",
    "gunfire",
    "stabbing",
    "knife",
    "weapon",
    "gun",
    "fight",
    "fighting",
    "hitting",
    "assault",
    "threatening",
    "threats",
  ],

  weather: [
    "flooding",
    "flooded",
    "water",
    "flood",
    "tree down",
    "tree fell",
    "branches",
    "power line",
    "power lines down",
    "sparking",
    "wind",
    "storm",
    "tornado",
    "hurricane",
    "roof",
    "damage",
    "debris",
  ],

  locations: [
    "parking lot",
    "intersection",
    "gas station",
    "walmart",
    "publix",
    "mall",
    "shopping center",
    "school",
    "hospital",
    "church",
    "beach",
    "park",
    "bridge",
  ],
} as const;

export function extractKeywords(
  transcript: string,
  category?: keyof typeof SURGE_KEYWORDS,
): string[] {
  const text = transcript.toLowerCase();
  const found: string[] = [];

  const searchCategories = category ? [SURGE_KEYWORDS[category]] : Object.values(SURGE_KEYWORDS);

  for (const keywordList of searchCategories) {
    for (const keyword of keywordList) {
      if (text.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    }
  }

  return [...new Set(found)];
}

export function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
  const set2 = new Set(keywords2.map((k) => k.toLowerCase()));
  const intersection = new Set([...set1].filter((k) => set2.has(k)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}
