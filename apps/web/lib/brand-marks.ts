/** Trademark display names for partner brands (user-facing copy only). */
export const NEST_TM = "Nest™";
export const GOOGLE_NEST_TM = "Google Nest™";
export const WYZE_TM = "Wyze™";

/** Join enabled brand marks for sentence copy ("Nest™ and Wyze™"). */
export function joinTrademarkList(names: Array<string | false | null | undefined>): string {
  const items = names.filter((name): name is string => typeof name === "string" && name.length > 0);
  if (items.length === 0) return "supported";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
