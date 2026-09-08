export type RapidSosLocationCandidate = {
  source: "RAPIDSOS";
  candidateOnly: true;
  lat?: number;
  lng?: number;
  uncertaintyMeters?: number;
};
