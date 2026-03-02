export function nowMs(): number {
  return Date.now();
}

export function elapsedMs(start: number): number {
  return Date.now() - start;
}
