/**
 * APCO-style disposition codes (ANS 1.111.2-2018 pattern).
 */

export interface APCODisposition {
  code: string;
  description: string;
}

function def(code: string, description: string): APCODisposition {
  return { code, description };
}

export const APCO_DISPOSITION_CODES = {
  CLR: def("CLR", "Cleared / completed"),
  CAN: def("CAN", "Cancelled"),
  DUP: def("DUP", "Duplicate"),
  UNF: def("UNF", "Unfounded"),
  GOA: def("GOA", "Gone on arrival"),
  UTL: def("UTL", "Unable to locate"),
  ADV: def("ADV", "Advised"),
  RPT: def("RPT", "Report taken"),
  ARR: def("ARR", "Arrest made"),
  CIT: def("CIT", "Citation issued"),
  WARN: def("WARN", "Warning issued"),
  REFER: def("REFER", "Referred to another agency"),
  TRANS: def("TRANS", "Transferred"),
  TRANSP: def("TRANSP", "Patient transported"),
  REFUSAL: def("REFUSAL", "Patient refusal"),
  DOA: def("DOA", "Deceased on arrival"),
  FALSE: def("FALSE", "False alarm"),
  EXT: def("EXT", "Fire extinguished"),
  CTRL: def("CTRL", "Situation controlled"),
  AID: def("AID", "Mutual aid given"),
  RECV: def("RECV", "Mutual aid received"),
  INFO: def("INFO", "Information only"),
  TEST: def("TEST", "Test / drill"),
  OTHER: def("OTHER", "Other disposition"),
} as const satisfies Record<string, APCODisposition>;

export type APCODispositionCode = keyof typeof APCO_DISPOSITION_CODES | (string & {});

export function isValidDispositionCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(APCO_DISPOSITION_CODES, code) || code.startsWith("X-");
}
