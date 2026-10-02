export function isStopKeyword(body: string): boolean {
  return /^(stop|unsubscribe|cancel|end|quit)$/i.test(body.trim());
}

export function isStartKeyword(body: string): boolean {
  return /^(start|unstop|subscribe|yes)$/i.test(body.trim());
}
