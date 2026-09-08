import { getLexSession, putLexSession, updateLexSession } from "./runtime-store.js";

export const getCallSession = getLexSession;
export const updateCallSession = updateLexSession;
export const writeCallSession = putLexSession;
