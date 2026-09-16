/**
 * Major US commercial airports for the operational map overlay.
 * Coordinates are aerodrome reference points (WGS84).
 */

export interface MajorAirport {
  icao: string;
  iata: string;
  name: string;
  lng: number;
  lat: number;
}

export const US_MAJOR_AIRPORTS: MajorAirport[] = [
  { icao: "KATL", iata: "ATL", name: "Hartsfield-Jackson Atlanta", lng: -84.4281, lat: 33.6407 },
  { icao: "KDFW", iata: "DFW", name: "Dallas/Fort Worth", lng: -97.038, lat: 32.8968 },
  { icao: "KDEN", iata: "DEN", name: "Denver", lng: -104.6737, lat: 39.8561 },
  { icao: "KORD", iata: "ORD", name: "Chicago O'Hare", lng: -87.9048, lat: 41.9742 },
  { icao: "KLAX", iata: "LAX", name: "Los Angeles", lng: -118.4081, lat: 33.9425 },
  { icao: "KCLT", iata: "CLT", name: "Charlotte Douglas", lng: -80.9431, lat: 35.214 },
  { icao: "KMCO", iata: "MCO", name: "Orlando", lng: -81.3089, lat: 28.4312 },
  { icao: "KMIA", iata: "MIA", name: "Miami", lng: -80.2906, lat: 25.7959 },
  { icao: "KPHX", iata: "PHX", name: "Phoenix Sky Harbor", lng: -112.0116, lat: 33.4343 },
  { icao: "KSEA", iata: "SEA", name: "Seattle-Tacoma", lng: -122.3088, lat: 47.4502 },
  { icao: "KIAH", iata: "IAH", name: "Houston Intercontinental", lng: -95.3414, lat: 29.9844 },
  { icao: "KJFK", iata: "JFK", name: "New York JFK", lng: -73.7781, lat: 40.6413 },
  { icao: "KEWR", iata: "EWR", name: "Newark Liberty", lng: -74.1745, lat: 40.6895 },
  { icao: "KLGA", iata: "LGA", name: "New York LaGuardia", lng: -73.8726, lat: 40.7769 },
  { icao: "KBOS", iata: "BOS", name: "Boston Logan", lng: -71.0052, lat: 42.3656 },
  { icao: "KDCA", iata: "DCA", name: "Washington Reagan", lng: -77.0377, lat: 38.8512 },
  { icao: "KIAD", iata: "IAD", name: "Washington Dulles", lng: -77.4565, lat: 38.9531 },
  { icao: "KBWI", iata: "BWI", name: "Baltimore/Washington", lng: -76.6683, lat: 39.1754 },
  { icao: "KPHL", iata: "PHL", name: "Philadelphia", lng: -75.2411, lat: 39.8729 },
  { icao: "KDTW", iata: "DTW", name: "Detroit Metro", lng: -83.3534, lat: 42.2124 },
  { icao: "KMSP", iata: "MSP", name: "Minneapolis-St Paul", lng: -93.2218, lat: 44.8848 },
  { icao: "KSLC", iata: "SLC", name: "Salt Lake City", lng: -111.9791, lat: 40.7899 },
  { icao: "KSFO", iata: "SFO", name: "San Francisco", lng: -122.375, lat: 37.6188 },
  { icao: "KSAN", iata: "SAN", name: "San Diego", lng: -117.19, lat: 32.7336 },
  { icao: "KLAS", iata: "LAS", name: "Las Vegas Harry Reid", lng: -115.1523, lat: 36.084 },
  { icao: "KPDX", iata: "PDX", name: "Portland", lng: -122.5975, lat: 45.5898 },
  { icao: "KAUS", iata: "AUS", name: "Austin-Bergstrom", lng: -97.6699, lat: 30.1945 },
  { icao: "KSAT", iata: "SAT", name: "San Antonio", lng: -98.4698, lat: 29.5337 },
  { icao: "KHOU", iata: "HOU", name: "Houston Hobby", lng: -95.2789, lat: 29.6454 },
  { icao: "KBNA", iata: "BNA", name: "Nashville", lng: -86.6782, lat: 36.1263 },
  { icao: "KMEM", iata: "MEM", name: "Memphis", lng: -89.9767, lat: 35.0424 },
  { icao: "KBHM", iata: "BHM", name: "Birmingham-Shuttlesworth", lng: -86.7535, lat: 33.5629 },
  { icao: "KSDF", iata: "SDF", name: "Louisville", lng: -85.736, lat: 38.1744 },
  { icao: "KCVG", iata: "CVG", name: "Cincinnati/Northern Kentucky", lng: -84.6678, lat: 39.0488 },
  { icao: "KIND", iata: "IND", name: "Indianapolis", lng: -86.2944, lat: 39.7173 },
  { icao: "KSTL", iata: "STL", name: "St Louis Lambert", lng: -90.3708, lat: 38.7487 },
  { icao: "KMCI", iata: "MCI", name: "Kansas City", lng: -94.7139, lat: 39.2976 },
  { icao: "KTPA", iata: "TPA", name: "Tampa", lng: -82.5332, lat: 27.9755 },
  { icao: "KFLL", iata: "FLL", name: "Fort Lauderdale", lng: -80.1527, lat: 26.0726 },
  { icao: "KJAX", iata: "JAX", name: "Jacksonville", lng: -81.6879, lat: 30.4941 },
  { icao: "KRSW", iata: "RSW", name: "Fort Myers", lng: -81.7552, lat: 26.5362 },
  { icao: "KSAV", iata: "SAV", name: "Savannah/Hilton Head", lng: -81.2024, lat: 32.1276 },
  { icao: "KCHS", iata: "CHS", name: "Charleston", lng: -80.0405, lat: 32.8986 },
  { icao: "KTYS", iata: "TYS", name: "Knoxville McGhee Tyson", lng: -83.994, lat: 35.811 },
  { icao: "KGSO", iata: "GSO", name: "Greensboro", lng: -79.9373, lat: 36.0978 },
  { icao: "KRDU", iata: "RDU", name: "Raleigh-Durham", lng: -78.7875, lat: 35.8776 },
  { icao: "KRIC", iata: "RIC", name: "Richmond", lng: -77.3197, lat: 37.5052 },
  { icao: "KORF", iata: "ORF", name: "Norfolk", lng: -76.2012, lat: 36.8946 },
  { icao: "KPIT", iata: "PIT", name: "Pittsburgh", lng: -80.2329, lat: 40.4915 },
  { icao: "KCLE", iata: "CLE", name: "Cleveland Hopkins", lng: -81.8498, lat: 41.4117 },
  { icao: "KCMH", iata: "CMH", name: "Columbus", lng: -82.8919, lat: 39.998 },
  { icao: "KMKE", iata: "MKE", name: "Milwaukee Mitchell", lng: -87.8966, lat: 42.9472 },
  { icao: "KMSY", iata: "MSY", name: "Louis Armstrong New Orleans", lng: -90.258, lat: 29.9934 },
  { icao: "KOKC", iata: "OKC", name: "Oklahoma City Will Rogers", lng: -97.6007, lat: 35.3931 },
  { icao: "KTUL", iata: "TUL", name: "Tulsa", lng: -95.8881, lat: 36.1984 },
  { icao: "KABQ", iata: "ABQ", name: "Albuquerque", lng: -106.6092, lat: 35.0402 },
  { icao: "KELP", iata: "ELP", name: "El Paso", lng: -106.3778, lat: 31.8073 },
  { icao: "KTUS", iata: "TUS", name: "Tucson", lng: -110.941, lat: 32.1161 },
  { icao: "KSMF", iata: "SMF", name: "Sacramento", lng: -121.5908, lat: 38.6954 },
  { icao: "KSJC", iata: "SJC", name: "San Jose", lng: -121.929, lat: 37.3626 },
  { icao: "KOAK", iata: "OAK", name: "Oakland", lng: -122.2208, lat: 37.7213 },
  { icao: "KBUR", iata: "BUR", name: "Burbank", lng: -118.3585, lat: 34.2007 },
  { icao: "KSNA", iata: "SNA", name: "Orange County", lng: -117.8682, lat: 33.6757 },
  { icao: "KONT", iata: "ONT", name: "Ontario", lng: -117.6012, lat: 34.056 },
  { icao: "PANC", iata: "ANC", name: "Anchorage", lng: -149.9962, lat: 61.1744 },
  { icao: "PHNL", iata: "HNL", name: "Honolulu", lng: -157.9224, lat: 21.3187 },
  { icao: "KBUF", iata: "BUF", name: "Buffalo", lng: -78.7322, lat: 42.9405 },
  { icao: "KROC", iata: "ROC", name: "Rochester", lng: -77.6724, lat: 43.1189 },
  { icao: "KSYR", iata: "SYR", name: "Syracuse", lng: -76.1063, lat: 43.1112 },
  { icao: "KALB", iata: "ALB", name: "Albany", lng: -73.8017, lat: 42.7483 },
  { icao: "KBDL", iata: "BDL", name: "Bradley Hartford", lng: -72.6832, lat: 41.9389 },
  { icao: "KPVD", iata: "PVD", name: "Providence", lng: -71.4204, lat: 41.724 },
  { icao: "KMHT", iata: "MHT", name: "Manchester", lng: -71.4357, lat: 42.9326 },
  { icao: "KPWM", iata: "PWM", name: "Portland Maine", lng: -70.3093, lat: 43.6462 },
];

export function airportsToGeoJSON(): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const ap of US_MAJOR_AIRPORTS) {
    if (seen.has(ap.iata)) continue;
    seen.add(ap.iata);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [ap.lng, ap.lat] },
      properties: { icao: ap.icao, iata: ap.iata, name: ap.name, label: ap.iata },
    });
  }
  return { type: "FeatureCollection", features };
}
