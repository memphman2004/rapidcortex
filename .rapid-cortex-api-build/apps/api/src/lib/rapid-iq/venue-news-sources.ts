export type VenueNewsSource = {
  name: string;
  url: string;
};

/** Venue / event industry RSS. BizBash /rss 404s after Informa acquisition — do not add it. */
export const VENUE_NEWS_SOURCES: VenueNewsSource[] = [
  { name: "VenueConnect", url: "https://www.venuesnow.com/feed" },
  { name: "Pollstar — Venues", url: "https://news.pollstar.com/category/venues/feed/" },
  { name: "Pollstar — VenuesNow", url: "https://news.pollstar.com/category/venuesnow/feed/" },
  { name: "Event Marketer", url: "https://www.eventmarketer.com/feed/" },
  { name: "Event Industry News", url: "https://www.eventindustrynews.com/feed/" },
  { name: "Special Events Magazine", url: "https://www.specialevents.com/feed/" },
  { name: "Sports Biz Journal", url: "https://www.sportsbusinessjournal.com/rss/Headlines.aspx" },
  { name: "Running USA", url: "https://www.runningusa.org/feed" },
];

export const VENUE_NEWS_KEYWORDS = [
  "venue safety",
  "event safety technology",
  "crowd management",
  "incident reporting",
  "stadium security",
  "arena upgrade",
  "event technology",
  "marathon safety",
  "race day operations",
  "event management platform",
  "security upgrade",
  "venue modernization",
];
