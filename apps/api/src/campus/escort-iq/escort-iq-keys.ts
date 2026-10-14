/** Dynamo keys for Escort iQ sessions (stored in CampusIncidentsTable). */
export const ESCORT_IQ_KEYS = {
  pk: (campusCode: string) => `CAMPUS#${campusCode.toUpperCase()}`,
  sessionSk: (escortId: string) => `ESCORT#${escortId}`,
  tokenPk: (tokenHash: string) => `ESCORT_TOKEN#${tokenHash}`,
  tokenSk: () => "TOKEN",
  statusGsiPk: (campusCode: string, status: string) =>
    `ESCORT_STATUS#${campusCode.toUpperCase()}#${status}`,
} as const;
