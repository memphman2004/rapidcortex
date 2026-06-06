import { randomUUID } from "node:crypto";

export const makeId = (prefix: string) => `${prefix}_${randomUUID()}`;
